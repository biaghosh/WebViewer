from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, BooleanField, IntegerField
from wtforms.validators import DataRequired, Email
from bivwebs.models import User
from flask_wtf.file import FileField, FileRequired

# class LoginForm(FlaskForm):
#     email = StringField('Email',
#                         validators=[DataRequired(), Email()])
#     password = PasswordField('Password', validators=[DataRequired()])
#     remember = BooleanField('Remember Me')
#     submit = SubmitField('Login')

class EmailOTPForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    otp = IntegerField('OTP', validators=[DataRequired()])
    submit = SubmitField('Verify OTP')

# class RmbkgdForm(FlaskForm):
#     image = FileField('Select Image:', validators=[FileRequired()])
#     submit = SubmitField('Upload')
