from pymongo.mongo_client import MongoClient
from pymongo.server_api import ServerApi

#sub in db_username and db_passcode, for vercel or modal specifics depending
uri = process.env.MongoDB_URI

# Create a new client and connect to the server
client = MongoClient(uri, server_api=ServerApi('1'))
# Send a ping to confirm a successful connection
try:
    client.admin.command('ping')
    print("Pinged your deployment. You successfully connected to MongoDB!")
except Exception as e:
    print(e)



db = client["eng"]
col = db["processed"]
for col in col.find():
    print (col)

