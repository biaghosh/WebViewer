from flask import Flask, render_template
from flask_bcrypt import Bcrypt
from flask_login import LoginManager

app = Flask(__name__)
app.config['SECRET_KEY'] = '157a176c56f1cfb0dc493223f7bca700'
app.config.update({'mongo': 'mongodb://bivwebviewer:wuyr3ILIUO30TwR5IlQLHUzAQxUjFuVSwWU0HlX20Lf9VuCqqMYz6P9lfdpW0a0MVJGee014XJyWACDbY9RCuw==@bivwebviewer.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@bivwebviewer@'})
app.config['TESTING'] = False

bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message_category = 'info'

app.config.update(
    MAIL_SERVER='smtp.ionos.com',
    MAIL_PORT=465,
    MAIL_USE_SSL=True,
    MAIL_USERNAME='webvieweradmin@bioinvision.com',
    MAIL_PASSWORD='wV!05162024CvZ781'
)

from bivwebs import routes