from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User
from app.models.customer import Customer
from app.square.sync import sync_customers, sync_transactions
from app.predictions.engine import generate_prediction
import logging

logger = logging.getLogger(__name__)


def nightly_job():
    """Sync Square data and refresh predictions for all connected users."""
    db: Session = SessionLocal()
    try:
        users = db.query(User).filter(User.square_access_token != None).all()
        for user in users:
            try:
                sync_customers(user, db)
                sync_transactions(user, db)
                customers = db.query(Customer).filter(Customer.user_id == user.id).all()
                for customer in customers:
                    try:
                        generate_prediction(customer, db)
                    except Exception as e:
                        logger.error("Prediction failed for customer %s: %s", customer.id, e)
                logger.info("Nightly job complete for %s", user.email)
            except Exception as e:
                logger.error("Nightly job failed for %s: %s", user.email, e)
    finally:
        db.close()


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(nightly_job, CronTrigger(hour=2, minute=0))
    scheduler.start()
    return scheduler
