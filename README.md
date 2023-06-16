# BioWebSoftware

# Before we run the wbapp locally, please export the environment of variable.

# > set FLASK_APP = application

# > flask run

Within the websw directory, run the following cmd to start the webapp locally.

> python -m flask run

To install dependencies run

> pip install -r requirements.txt

The web application depends on a mongoDB database for it's metadata
From the mongo bin directory, run

> .\mongod.exe --dbpath="c:\data\db"
