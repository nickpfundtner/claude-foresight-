from sqlalchemy import inspect


def test_error_logs_table_created(test_engine):
    inspector = inspect(test_engine)
    cols = {c["name"] for c in inspector.get_columns("error_logs")}
    assert "id" in cols
    assert "operation" in cols
    assert "context" in cols
    assert "alert_sent" in cols
    assert "resolved" in cols


def test_customer_health_table_created(test_engine):
    inspector = inspect(test_engine)
    cols = {c["name"] for c in inspector.get_columns("customer_health")}
    assert "customer_id" in cols
    assert "sync_skip" in cols
    assert "prediction_fallback" in cols
    assert "sync_skip_until" in cols
