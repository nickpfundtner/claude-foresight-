from pydantic import BaseModel

class ConnectSquareRequest(BaseModel):
    access_token: str
    location_id: str

class SyncResponse(BaseModel):
    customers_synced: int
    transactions_synced: int
