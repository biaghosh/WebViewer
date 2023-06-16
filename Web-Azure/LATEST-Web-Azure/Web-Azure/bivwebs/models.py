from datetime import datetime
from bivwebs import login_manager, app
from flask_login import UserMixin
from pymongo import MongoClient
import uuid
from bson import ObjectId


@login_manager.user_loader
def load_user(user_id):
    client = MongoClient(app.config['mongo'])
    db = client.admin
    collection = db.Users
    user = collection.find_one({"id": user_id})
    if not user:
        return None
    return User(user['email'], user['password'], user['id'], user['level'], True)


class User(UserMixin):

    def __init__(self, email, password,level, auth):
        self.email = email
        self.password = password
        # self.id = id
        self.level = level
        self.is_authenticated = auth

    def is_authenticated(self):
        return True

    def is_active(self):
        return True

    def is_anonymous(self):
        return False

    def get_id(self):
        return self.id

    def __repr__(self):
        return f"User('{self.email}')"
