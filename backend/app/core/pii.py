from app.models.customer import Customer


def strip_pii(customer: Customer) -> dict:
    """Return anonymized customer data safe to send to Anthropic.
    Never includes name, email, or phone. Only behavioral data."""
    return {
        "id": f"Customer #{abs(hash(str(customer.id))) % 10000}",
        "total_visits": customer.total_visits,
        "total_spent": customer.total_spent,
        "first_visit_at": customer.first_visit_at,
        "last_visit_at": customer.last_visit_at,
    }
