import os
import sys
import io
import datetime
from flask import render_template, url_for, flash, redirect, request, abort, jsonify, make_response, send_file, session
import requests
from azure.storage.fileshare import ShareFileClient
from azure.storage.blob import BlobServiceClient, ContentSettings,generate_blob_sas, BlobSasPermissions
from bivwebs import app, bcrypt
from bivwebs.forms import LoginForm
from bivwebs.forms import EmailOTPForm
from bivwebs.models import User
from urllib.parse import urlparse, urljoin
from werkzeug.utils import secure_filename
from bson import ObjectId
from bson.json_util import dumps
from pymongo import MongoClient
from PIL import Image
import numpy as np
from skimage import io as sio
from scipy.ndimage.morphology import distance_transform_edt, binary_dilation
from scipy.interpolate import interpn
import gridfs
import json
import zipfile
import bson
import base64
import random
from flask_mail import Mail, Message
import secrets
import time
from email.mime.image import MIMEImage
import mimetypes

@app.route("/")
@app.route("/home")
def home():
    return render_template('home.html', title="Home")


@app.route("/applications")
def applications():
    return render_template('applications.html', title="Applications")


@app.route("/events")
def events():
    return render_template('events.html', title="News and Events")


@app.route("/collaborators")
def collaborators():
    return render_template('collaborators.html', title="Collaborators")


@app.route("/about")
def about():
    return render_template('about.html', title='About')

def is_safe_url(target):
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme in ('http', 'https') and ref_url.netloc == test_url.netloc


@app.route('/login', methods=['GET', 'POST'])
def login():
    form = EmailOTPForm()
    if request.method == 'POST':
        if form.validate_on_submit():
            email = form.email.data
            otp_input = form.otp.data

            # Retrieve the OTP from the session or database
            # In this example, we'll get it from the session
            if session.get('otp') and int(session['otp']['value']) == otp_input and session['otp']['expire'] > time.time():
                # OTP is correct, user is authenticated
                # Here, you can log in the user and redirect them to another page
                session.pop('otp', None)
                client = MongoClient(app.config['mongo'])
                db = client.BIV
                users = db.Users
                user = users.find_one({"email": email})
                if user:
                    users.update_one({"email": form.email.data}, { "$set": {"lastLogin": datetime.datetime.now(), "logins": user['logins']+1}})
                    session['email'] = email
                    session['level'] = user['level']
                    session['multiAvailable'] = user['multiAvailable']
                    # next_page = request.args.get('next')
                    flash('Logged in successfully.', 'success')
                    return redirect('viewer')   # Replace 'index' with the desired route
                else:
                    flash('Logged in unsuccessfully.', 'error')
            else:
                form.otp.errors.append('Invalid OTP')
                # OTP is incorrect or missing
                # flash('Invalid OTP. Please try again.', 'warning')

    return render_template('login.html', form=form)

@app.route("/logout")
def logout():
    # logout_user()
    session.pop('email', None)
    session.pop('id', None)
    session.pop('level', None)
    return redirect(url_for('home'))


@app.route("/account")
def account():
    if 'email' not in session:
        return redirect(url_for('login'))
    return render_template('account.html', title='Account')


@app.route("/marketing")
def marketing():
    # if current_user.level != Admin kick
    if 'email' not in session:
        return redirect(url_for('login'))
    if 'level' != 'admin':
        return render_template('403.html'), 403
    return render_template('marketing.html', title='Marketing')


@app.route("/webview")
def webview():
    if 'email' not in session:
        return redirect(url_for('login'))
    return render_template('webview.html', title='Web3DView')


@app.route("/getAnnotations", methods=['POST'])
def getAnnotations():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.Annotations
    data = ds.find({
        "dataset": json["dataset"],
        #                "moduality": json["moduality"],
        #                "exposure": json["exposure"],
        #                "wavelength": json["wavelength"],
        "slice": json["slice"],
        #                 "user": session['email'],
        "status": 'active'
    }, {"_id": 0})
    return make_response(dumps(data), 200)

@app.route("/saveAnnotation", methods=['POST'])
def saveAnnotation():
    # print(session['email'])
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()

    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.annotations
    # Disallowing same annotation names behind the scene
    # NEEDS WORK BECAUSE THIS BASIC IMPLEMENTATION DOES NOT WORK
    # LETS GRAB HIGHEST INSTANCE

    d = ds.aggregate([
        {
            "$match":
            {
                "text": json["text"]
                # "status": "active"

            }
        },
        {
            '$count': 'c'
        }

    ])
    json["instance"] = ''
    for result in d:
        json["instance"] = result['c']

    ds.insert_one({
        "dataset": json["dataset"],
        "slice": json["slice"],
        "user": session['email'],
        "moduality": json["moduality"],
        "exposure": json["exposure"],
        "wavelength": json["wavelength"],
        "text": json["text"],
        "instance": json["instance"],
        "x": json["x"],
        "y": json["y"],
        "datetime": json["datetime"],
        "comments": '',
                    "status": 'active'
    })

    json["user"] = session['email']
    return make_response(jsonify(json), 200)


@app.route("/updateAnnotation", methods=['POST'])
def updateAnnotation():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    if json["instance"] != '':
        json["instance"] = int(json["instance"])
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.annotations
    ds.update_one({
        "dataset": json["dataset"],
        "slice": json["slice"],
        #                "moduality": json["moduality"],
        #                "exposure": json["exposure"],
        #                "wavelength": json["wavelength"],
        "text": json["text"],
        "instance": json["instance"],
        "status": 'active'
    },
        {'$set': {
            "user": session['email'],
            "x": json["x"],
            "y": json["y"],
            "datetime": json["datetime"]
        }})

    data = '{}'
    return make_response(dumps(data), 200)


@app.route("/updateAnnotationComments", methods=['POST'])
def updateAnnotationComments():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.annotations
    # print(json)
    ds.update_one({
        "dataset": json["dataset"],
        "slice": json["slice"],
        "text": json["oldText"],
        "instance": int(json["instance"]),
        #                "moduality": json["moduality"],
        #                "exposure": json["exposure"],
        #                "wavelength": json["wavelength"],
        "instance": int(json["instance"]),
        "status": 'active'
    },
        {'$set': {
            "text": json["text"],
            "comments": json["comments"]
        }})

    data = '{}'
    return make_response(dumps(data), 200)


@app.route("/deleteAnnotation", methods=['POST'])
def deleteAnnotation():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.annotations
    if int(json["instance"]) == 0:
        json["instance"] = ''
    else:
        json["instance"] = int(json["instance"])

    # print(json)
    ds.update_one({
        "dataset": json["dataset"],
        "slice": json["slice"],
        #                "moduality": json["moduality"],
        #                "exposure": json["exposure"],
        #                "wavelength": json["wavelength"],
        "text": json["text"],
        "instance": json["instance"]
    },
        {'$set': {
            "status": "hidden"
        }})

    data = '{}'
    return make_response(dumps(data), 200)

@app.route('/addAssignedDataset/<email>/<datasetName>', methods=['POST'])
def add_assigned_dataset(email, datasetName):
#   print(email,datasetName)
  client = MongoClient(app.config['mongo'])
  db = client.BIV
  users = db.Users
  user = users.find_one({"email": email})
  if user:
    # If the user exists, add the dataset to the user's list of datasets
    if datasetName not in user["datasets"]:
        users.update_one({"email": email}, {"$push": {"datasets": datasetName}})
        return jsonify({"message": "Successfully added dataset to user's dataset list"}), 200
    else:
        return jsonify({"message": "Dataset is already in user's dataset list"}), 200
  else:
        return jsonify({"message": "User does not exist"}), 200
  
@app.route('/removeUserDataset/<email>/<dataset>', methods=['POST'])
def remove_user_dataset(email, dataset):
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.Users
    # Query a specified user
    user = ds.find_one({"email": email})
    if user:
        # If the user exists, add the dataset to the user's list of datasets
        if dataset in user["datasets"]:
            ds.update_one({"email": email}, {"$pull": {"datasets": dataset}})
            return jsonify({"message": "Successfully removed dataset from user's dataset list"}), 200
        else:
            return jsonify({"message": "Dataset is not in user's dataset list"}), 409
    else:
        return jsonify({"message": "User does not exist"}), 404

# Define the interface for obtaining user data sets
@app.route('/getUserDatasets/<email>', methods=['GET'])
def get_user_datasets(email):
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.Users
    user = ds.find_one({'email': email})
    if user is None:
        return jsonify([])  # Returns an empty array if the user does not exist
    user_datasets = user.get('datasets', [])  # Get a list of datasets for a user
    return jsonify(user_datasets)

@app.route('/getDatasets', methods=['GET'])
def get_datasets():
    datasets = []
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.datasets
    for dataset in ds.find():
        datasets.append({
            'name': dataset['name']
        })
    return jsonify(datasets)

@app.route("/getDatasetInfo", methods=['POST'])
def getDatasetInfo():
    if 'email' not in session:
        return redirect(url_for('login'))
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.datasets
    json = request.get_json()
    #nameAbbr = { 
    #    "": "Bf", 
    #    "Fluorescent": "Fl", 
    #    "NearInfrared": "NIR", 
    #} 
    d = ds.aggregate([ 
        {
            "$lookup":
            {
                "from": "annotations",
                "localField": "name",
                "foreignField": "dataset",
                "as": "ann"
            }
        },
        {
            "$match":
            {

                "name": json["name"]
                # "ann.status": "active"

            }
        },
        {
            "$project": {
                "_id": 0,
                "name": 1,
                "types": 1,
                "voxels": 1,
                "dims3": 1,
                "pixelLengthUM": 1,
                "dims2": 1,
                "imageDims": 1,
                "zskip": 1,
                "info": 1,
                "ann.slice": 1,
                "ann.user": 1,
                "ann.moduality": 1,
                "ann.exposure": 1,
                "ann.wavelength": 1,
                "ann.instance": 1,
                "ann.x": 1,
                "ann.y": 1,
                "ann.datetime": 1,
                "ann.text": 1,
                "ann.comments": 1,
                "ann.status": 1
                
            }
        },
        # {
        #    "$group":
        #    {
        #        "_id": {
        #            "id": "$_id",
        #            "name": "$name",
        #            "types": "$types",
        #            "voxels": "$voxels",
        #            "dims2": "$dims2",
        #            "dims3": "$dims3",
        #            "imageDims": "$imageDims",
        #            "info": "$info",
        #            "zskip": "$zskip",
        #        },
        #        "annSlices": { "$addToSet": "$ann"}

        #     }
        # },
    ])
    response_data = {
        'session': dict(session),
        'dataset_info': list(d),
    }
    return make_response(jsonify(response_data), 200)


@app.route("/viewer")
def viewer():
    if 'email' not in session:
        return redirect(url_for('login'))
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    users = db.Users
    user = users.find_one({"email": session['email']})
    # bcrypt.generate_password_hash("zxcvb1",form.password.data)})
    ds = user["datasets"]
    return render_template('three_new popup.html', title='Viewer', datasets=ds)


@app.route("/multiviewer")
def multiviewer():
    if 'email' not in session:
        return redirect(url_for('login'))
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    users = db.Users
    user = users.find_one({"email": session['email']})
    # bcrypt.generate_password_hash("zxcvb1",form.password.data)})
    ds = user["datasets"]
    return render_template('multithree.html', title='Multi-Viewer', datasets=ds)


@app.route("/accounts")
def accounts():
    if 'email' not in session:
        return redirect(url_for('login'))
    if session['level'] != 'admin':
        return render_template('403.html'), 403
    return render_template('accounts.html', title='Accounts')

@app.route("/datasets")
def datasets():
    if 'email' not in session:
        return redirect(url_for('login'))
    if session['level'] != 'admin':
        return render_template('403.html'), 403
    return render_template('datasets.html', title='Datasets')


@app.route("/getUsers", methods=['GET'])
def getUsers():
    if 'email' not in session:
        return redirect(url_for('login'))
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    users = db.Users
    usersResult = users.find()
    return make_response(dumps(usersResult), 200)


@app.route("/createUser", methods=['POST'])
def createUser():
    if 'email' not in session:
        return redirect(url_for('login'))

    # Get the form information submitted by the web page
    json = request.get_json()


    # Establish database connection
    client = MongoClient(app.config['mongo'])

    # Get the specified Collection
    db = client.BIV

    # Get the specified data table
    users = db.Users

    # Get existing users (mailboxes)
    email_list = []
    for x in users.find():
        email_list.append(x['email'])

    # Query whether a user already exists, return if it exists, create a new user if it does not exist

    if json['email'] in email_list:
        return redirect(url_for('accounts'))
    # userId = db.Counts.find_one_and_update({"name": "userIncrement"},{'$inc':{ "userId" :1 }},new=True)
    # generate user id
    # userId = users.find_one_and_update({},{ '$inc': {"id" : 1}})

    # Add new user
    users.insert_one({"email": json['email'], "level": json['level'],
                     "multiAvailable": True, "logins": 0, "lastLogin": '', 'datasets': []})
    send = '{ "success": "cookie"}'
    return make_response(send, 200)


@app.route("/deleteUser", methods=['POST'])
def deleteUser():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    if json['email'] == session['email']:
        return jsonify({'status': 'failed', 'message': 'Can not delete current account'})
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    users = db.Users
    # print(json['email'])
    usersResult = users.delete_one({"email": json['email']})
    send = '{ "success": "cookie"}'
    return jsonify({'status': 'success', 'message': 'Delete successfully'})


@app.route("/volRender")
def volRender():
    if 'email' not in session:
        return redirect(url_for('login'))
    return render_template('volRender.html', title='Web3DView')

# pull a slice out of the stacked tiff and send it as webp
# This function appears to send the data for 1/10th the cost


@app.route("/getSlice", methods=['POST'])
def getSlice():
    print("getSlice")
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    im = sio.imread("C:\websw\\bivwebs\static\cryoData\\" +
                    json['name'] + "\\" + json['wavelength'] + "Volume.tif", plugin='tifffile')
    img = Image.fromarray(im[int(json["slice"])])
    # print(im.shape, file=sys.stdout)
    width, height = img.size
    width *= float(json["scale"])
    height *= float(json["scale"])
    scaledImg = img.resize((int(width), int(height)), resample=Image.BILINEAR)
    tempFile = io.BytesIO()
    scaledImg.save(tempFile, 'webp')
    tempFile.seek(0)
    return send_file(
        tempFile,
        attachment_filename='slice.webp'
    )


@app.route("/getViews", methods=['POST'])
def getViews():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    im = sio.imread("C:\websw\\bivwebs\static\cryoData\\" +
                    json['name'] + "\\" + json['wavelength'] + "Volume.tif", plugin='tifffile')
    # would need to loop through all
    img = Image.fromarray(im[int(json["slice"])])
    z, h, w = im.shape
    w *= float(json["scale"])
    h *= float(json["scale"])
    scaledImg = img.resize((int(w), int(h)), resample=Image.BILINEAR)
    tempFile = io.BytesIO()
    scaledImg.save(tempFile, 'webp')
    tempFile.seek(0)
    return send_file(
        tempFile,
        attachment_filename='slice.webp'
    )


@app.route("/saveView", methods=['POST'])
def saveView():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.views
    #Disallowing same annotation names behind the scene
    count = ds.count_documents({
                    "dataset": json["dataset"],
                    "moduality": json["moduality"],
                    "exposure": json["exposure"],
                    "wavelength": json["wavelength"],
                    "name": json["name"]
                })
    if count != 0:
        json["name"] = json["name"] + ' (%d)' % (count)

    ds.insert_one({
        "dataset": json["dataset"],
        "slice": json["slice"],
        "user": session['email'],
        "moduality": json["moduality"],
        "exposure": json["exposure"],
        "wavelength": json["wavelength"],
        "name": json["name"],
        "x": json["x"],
        "y": json["y"],
        "z": json["z"],
        "xxz": json["xxz"],
        "yxz": json["yxz"],
        "zxz": json["zxz"],
        "xyz": json["xyz"],
        "yyz": json["yyz"],
        "zyz": json["zyz"],
        'xClip': json["xClip"],
        'yClip': json["yClip"],
        'threshold': json["threshold"],
        "datetime": json["datetime"]
    })
    send = '{ "name": "' + json["name"] + '"}'
    return make_response(send, 200)


@app.route("/delView", methods=['POST'])
def delView():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.views
    ds.delete_one({
        "dataset": json["dataset"],
        "name": json["name"]
    })

    return make_response('{}', 200)


@app.route("/getView", methods=['POST'])
def getView():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.views
    data = '{}'
    # print(json, file=sys.stdout)
    if 'name' not in json:
        data = ds.find({
            "dataset": json["dataset"]
        })
    else:
        data = ds.find_one({
            "dataset": json["dataset"],
            "name": json["name"]
        })
    return make_response(dumps(data), 200)


@app.route("/saveMask", methods=['POST'])
def saveMask():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.masks
    dsMasksData = db.MasksData
    # currently not checking for name uniqueness
    # if not long computation time, should be able to move this after interpolation
    # not too long, roughly 30seconds a slice
    ds.insert_one({
        "dataset": json["dataset"],
        "minSlice": json["minSlice"],
        "maxSlice": json["maxSlice"],
        "user": session['email'],
        "name": json["name"],
        "datetime": json["datetime"],
        # "verts": json["verts"],
        # "mask": json["mask"],
        "generated": "no",
        "interpolated": "no"
    })
    # need to sort array for sure LATER PRIO
    maskList = json["mask"]

    for i in range(len(maskList)-1):
        sliceGap = int(maskList[i+1]['slice']) - int(maskList[i]['slice'])

        for x in range(1, sliceGap):
            precisionIncrement = 1 / (sliceGap / x)
            result = interp_shape(
                maskList[i]['mask'], maskList[i+1]['mask'],  precisionIncrement)
            result = result*1
            newRecord = {}
            newRecord['slice'] = str(int(maskList[i]['slice']) + x)
            newRecord['mask'] = result.tolist()
            # TODO HERE ADD SORTING LOGIC
            # https://stackoverflow.com/questions/6989100/sort-points-in-clockwise-order
            maskList.append(newRecord)
            dsMasksData.insert_one({
                "dataset": json["dataset"],
                "name": json["name"],
                "slice": newRecord['slice'],
                "mask": newRecord['mask']
            })
    # issue 2 masks will have to be their own document, size limit reached
    ds.update_one({"dataset": json["dataset"], "name": json["name"],
                  "datetime": json["datetime"]}, {"$set": {"interpolated": "yes"}})

    return make_response(dumps(maskList), 200)


@app.route("/saveMaskNoInterpolation", methods=['POST'])
def saveMaskNoInterpolation():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.masks
    dsMasksData = db.MasksData
    # currently not checking for name uniqueness
    # if not long computation time, should be able to move this after interpolation
    # not too long, roughly 30seconds a slice
    ds.insert_one({
        "dataset": json["dataset"],
        "minSlice": json["minSlice"],
        "maxSlice": json["maxSlice"],
        "user": session['email'],
        "name": json["name"],
        "datetime": json["datetime"],
        # "verts": json["verts"],
        # "mask": json["mask"],
        "interpolated": "no"
    })
    # need to sort array for sure LATER PRIO
    vertList = json["verts"]

    for i in range(len(vertList)):
        dsMasksData.insert_one({
            "dataset": json["dataset"],
            "name": json["name"],
            "generated": "no",
            "slice": vertList[i]['slice'],
            "verts": vertList[i]['verts']
        })
    ds.update_one({"dataset": json["dataset"], "name": json["name"],
                  "datetime": json["datetime"]}, {"$set": {"interpolated": "no"}})

    return make_response(dumps(vertList), 200)


@app.route("/getMasks", methods=['POST'])
def getMasks():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.masks
    data = ds.find({
        "dataset": json["dataset"],
        "user": session['email']
    })

    return make_response(dumps(data), 200)


@app.route("/getMaskSlices", methods=['POST'])
def getMaskSlices():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.masks
    data = ds.find({
        "dataset": json["dataset"],
        "user": session['email']
    })
    dsMasksData = db.MasksData
    data = dsMasksData.find({
        "dataset": json["dataset"],
        "name": json["name"]
    })
    return make_response(dumps(data), 200)
    #############################
    ### INTERPOLATION SECTION ###


def signed_bwdist(im):
    im = -bwdist(bwperimReplace(im))*np.logical_not(im) + \
        bwdist(bwperimReplace(im))*im
    return im


def bwdist(im):
    '''
    Find distance map of image
    '''
    dist_im = distance_transform_edt(1-im)
    return dist_im


def interp_shape(top, bottom, precision):
    '''
    Interpolate between two contours

    Input: top 
            [X,Y] - Image of top contour (mask)
           bottom
            [X,Y] - Image of bottom contour (mask)
           precision
             float  - % between the images to interpolate 
                Ex: num=0.5 - Interpolate the middle image between top and bottom image
    Output: out
            [X,Y] - Interpolated image at num (%) between top and bottom

    '''
    if precision > 2:
        print("Error: Precision must be between 0 and 1 (float)")

    # top = np.array(top)
    # print(top.shape)
    # bottom = np.array(bottom)
    top = signed_bwdist(top)
    bottom = signed_bwdist(bottom)

    # row,cols definition
    r, c = top.shape

    # Reverse % indexing
    precision = 1+precision

    # rejoin top, bottom into a single array of shape (2, r, c)
    top_and_bottom = np.stack((top, bottom))

    # create ndgrids
    points = (np.r_[0, 2], np.arange(r), np.arange(c))
    xi = np.rollaxis(np.mgrid[:r, :c], 0, 3).reshape((r*c, 2))
    xi = np.c_[np.full((r*c), precision), xi]

    # Interpolate for new plane
    out = interpn(points, top_and_bottom, xi)
    out = out.reshape((r, c))

    # Threshold distmap to values above 0
    out = out > 0

    return out


__all__ = ['bwperim']

# May be a viable replacement to bwperim


def bwperimReplace(im):
    return 0 - (im - binary_dilation(im))


def bwperim(bw, n=4):

    if n not in (4, 8):
        raise ValueError('mahotas.bwperim: n must be 4 or 8')
    rows, cols = bw.shape

    # Translate image by one pixel in all directions
    north = np.zeros((rows, cols))
    south = np.zeros((rows, cols))
    west = np.zeros((rows, cols))
    east = np.zeros((rows, cols))

    north[:-1, :] = bw[1:, :]
    south[1:, :] = bw[:-1, :]
    west[:, :-1] = bw[:, 1:]
    east[:, 1:] = bw[:, :-1]
    idx = (north == bw) & \
          (south == bw) & \
          (west == bw) & \
          (east == bw)
    if n == 8:
        north_east = np.zeros((rows, cols))
        north_west = np.zeros((rows, cols))
        south_east = np.zeros((rows, cols))
        south_west = np.zeros((rows, cols))
        north_east[:-1, 1:] = bw[1:, :-1]
        north_west[:-1, :-1] = bw[1:, 1:]
        south_east[1:, 1:] = bw[:-1, :-1]
        south_west[1:, :-1] = bw[:-1, 1:]
        idx &= (north_east == bw) & \
               (south_east == bw) & \
               (south_west == bw) & \
               (north_west == bw)
    return ~idx * bw

@app.route('/files/<filename>')
def preview_file(filename):
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    fs = db['files.files']
    file_data = fs.find_one({'name':filename})
    file_url = file_data['URL']
    return jsonify({'file_url': file_url})


@app.route("/getFiles", methods=['POST'])
def getFiles():
    if 'email' not in session:
        return redirect(url_for('login'))
    json = request.get_json()
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.files.files
    data = '{}'
    # print(json, file=sys.stdout)
    data = ds.find({
            "dataset": json["dataset"],
        })
    return make_response(dumps(data), 200)

@app.route('/upload',methods=['POST'])
def store_image():
    if 'file' not in request.files:
        return 'No file part', 400
    
    file = request.files['file']
    datasetName = request.form.get('datasetName')
    filename = secure_filename(file.filename)

    client = MongoClient(app.config['mongo'])
    db = client.BIV
    fs = gridfs.GridFS(db,collection='files')
    format = filename.split(".")[-1]

    if format == "mp4":
        # Replace with your own connection string
        AZURE_CONNECTION_STRING = "DefaultEndpointsProtocol=https;AccountName=bivlargefiles;AccountKey=PPPXG+UXhU+gyB4WWWjeRMdE4Av8Svfnc9IOPd66hxsnIwx9IpP3C8aj/OA311i1zt+qF/Jkbg4l+AStegZGxw==;EndpointSuffix=core.windows.net"
        CONTAINER_NAME = "videos"
        blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
        
        # Generate a unique blob name
        blob_name = file.filename
        # print(blob_name)
        # Get a reference to the container
        container_client = blob_service_client.get_container_client(CONTAINER_NAME)

        # Upload the video
        content_settings = ContentSettings(content_type='video/mp4')
        container_client.upload_blob(blob_name, file.stream, content_settings=content_settings)

        # Generate the Blob URL
        sas_token = generate_blob_sas(
            account_name=blob_service_client.account_name,
            container_name=CONTAINER_NAME,
            blob_name=blob_name,
            account_key=blob_service_client.credential.account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.datetime.utcnow() + datetime.timedelta(hours=1)
        )
        blob_url = f"https://{blob_service_client.account_name}.blob.core.windows.net/{CONTAINER_NAME}/{blob_name}"
        doc = {
            "name" : filename,
            'upload_date': datetime.datetime.now(),
            "dataset" : datasetName,
            "user" : session['email'],
            "format": format,
            "URL": blob_url
        }
        fs.put(file,**doc)
    elif format == "png" or format == "jpg":
        # Replace with your own connection string
        AZURE_CONNECTION_STRING = "DefaultEndpointsProtocol=https;AccountName=bivlargefiles;AccountKey=PPPXG+UXhU+gyB4WWWjeRMdE4Av8Svfnc9IOPd66hxsnIwx9IpP3C8aj/OA311i1zt+qF/Jkbg4l+AStegZGxw==;EndpointSuffix=core.windows.net"
        CONTAINER_NAME = "images"
        blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
        
        # Generate a unique blob name
        blob_name = file.filename

        # Get a reference to the container
        container_client = blob_service_client.get_container_client(CONTAINER_NAME)

        # Upload the image
        content_settings = ContentSettings(content_type='image/png')
        container_client.upload_blob(blob_name, file.stream, content_settings=content_settings)

        # Generate the Blob URL
        sas_token = generate_blob_sas(
            account_name=blob_service_client.account_name,
            container_name=CONTAINER_NAME,
            blob_name=blob_name,
            account_key=blob_service_client.credential.account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.datetime.utcnow() + datetime.timedelta(hours=1)
        )
        blob_url = f"https://{blob_service_client.account_name}.blob.core.windows.net/{CONTAINER_NAME}/{blob_name}"
        # print(blob_url)
        doc = {
            "name" : filename,
            'upload_date': datetime.datetime.now(),
            "dataset" : datasetName,
            "user" : session['email'],
            "format": format,
            "URL": blob_url
        }
        fs.put(file,**doc)
    elif format == "txt":
        # Replace with your own connection string
        AZURE_CONNECTION_STRING = "DefaultEndpointsProtocol=https;AccountName=bivlargefiles;AccountKey=PPPXG+UXhU+gyB4WWWjeRMdE4Av8Svfnc9IOPd66hxsnIwx9IpP3C8aj/OA311i1zt+qF/Jkbg4l+AStegZGxw==;EndpointSuffix=core.windows.net"
        CONTAINER_NAME = "txt"
        blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
        
        # Generate a unique blob name
        blob_name = file.filename

        # Get a reference to the container
        container_client = blob_service_client.get_container_client(CONTAINER_NAME)

        # Upload the txt file
        content_settings = ContentSettings(content_type='text/plain')
        container_client.upload_blob(blob_name, file.stream, content_settings=content_settings)

        # Generate the Blob URL
        sas_token = generate_blob_sas(
            account_name=blob_service_client.account_name,
            container_name=CONTAINER_NAME,
            blob_name=blob_name,
            account_key=blob_service_client.credential.account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.datetime.utcnow() + datetime.timedelta(hours=1)
        )
        blob_url = f"https://{blob_service_client.account_name}.blob.core.windows.net/{CONTAINER_NAME}/{blob_name}"
        # print(blob_url)
        doc = {
            "name" : filename,
            'upload_date': datetime.datetime.now(),
            "dataset" : datasetName,
            "user" : session['email'],
            "format": format,
            "URL": blob_url
        }
        fs.put(file,**doc)
        
    
    return make_response('{}',200)

@app.route('/download',methods=['POST'])
def download_files():
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    file_name = request.json
    if len(file_name) == 0:
        return
    format = file_name.split(".")[-1] 
    # print(format)
    fs = db['files.files']

    file_url = fs.find_one({'name':file_name})['URL']
    response = requests.get(file_url)
    if response.status_code == 200:
        file_content = response.content
    else:
        return "Unable to download the file", 500
    
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, mode='w', compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(file_name, file_content)

    zip_buffer.seek(0)
    return send_file(zip_buffer, attachment_filename='file_download.zip', as_attachment=True)

@app.route('/delete', methods=['POST'])
def delete_files():
    filesName = request.json
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    fs = db['files.files']
    chunks = db['files.chunks']
    for chunk in fs.find({'name': filesName}):
        chunks.delete_many({'files_id': chunk['_id']})
    fs.delete_one({'name': filesName})
    return 'Files deleted successfully!'

@app.route('/send_otp', methods=['POST'])
def send_otp():
    mail = Mail(app)
    email = request.json['email']
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    users = db.Users
    user = users.find_one({"email": email})
    # if user and bcrypt.check_password_hash(user["password"], form.password.data):
    if not user:
        return jsonify({'status': 'failed', 'message': 'User does not exist, please re-enter'})
    # generate OTP and store in session
    otp = str(secrets.randbits(16))
    session['otp'] = {'value': otp, 'expire': time.time() + 300}
    # send OTP to email
    html_body = f"""\
        <html>
            <head>
                <style>
                    body {{
                            font-family: Arial, sans-serif;
                            font-size: 14px;
                            color: #333;
                            }}
                    strong {{
                            color: #007BFF;
                            }}
                    </style>
            </head>
            <body>
                <p style="line-height: 1.5;">Your OTP for BioInVision Web login is: <strong>{otp}</strong>, which will expire in 5 min.<br>
                <br>
                <p style="line-height: 1.5;color: #666;"
                    781 Beta Drive, Suite E,<br>
                    Mayfield Village, OH, 44143<br>
                    Phone: (216) 373-1500<br>
                    Fax: (216) 210-9375<br>
                    www.bioinvision.com
                </p>
                </p>
                <img src="https://bivlargefiles.blob.core.windows.net/images/logo.jpg" alt="BIV Logo">
            </body>
        </html>
        """
    msg = Message('BioInVision Web Login OTP', sender=app.config['MAIL_USERNAME'],recipients=[email])
    msg.html = html_body
    mail.send(msg)
    return jsonify({'status': 'success', 'message': f"OTP has been sent to '{email}, if you do not receive it, please check your spam'."})




@app.route('/dataset_upload', methods=['POST'])
def upload_file():
    print("upload")
    print("ds")
    # Azure存储账户名和账户密钥，这些信息应该从Azure门户中获得
    azure_storage_account_name = "bivlargefiles"
    azure_storage_account_key = "PPPXG+UXhU+gyB4WWWjeRMdE4Av8Svfnc9IOPd66hxsnIwx9IpP3C8aj/OA311i1zt+qF/Jkbg4l+AStegZGxw=="

    # 创建 Azure ShareFileClient
    share = "data"
    share_file_client = ShareFileClient.from_connection_string(
    conn_str=f"DefaultEndpointsProtocol=https;AccountName={azure_storage_account_name};AccountKey={azure_storage_account_key};EndpointSuffix=core.windows.net",
    share_name=share,
    file_path="")

    # 尝试列出分享下的文件或目录
    try:
        my_files = share_file_client.list_directories_and_files()
        for file in my_files:
            print(file.name)
        print('Connection to Azure Share Files successful.')
    except Exception as e:
        print(f'Failed to connect to Azure Share Files: {e}')

    file = request.files['file']

    # 这里我们直接使用文件名作为Azure存储中的名字，注意在实际项目中可能需要处理文件名冲突或者使用其他方式生成存储中的文件名
    azure_file_name = file.filename

    # 创建一个新的FileClient用于上传文件
    file_client = share_file_client.get_file_client(azure_file_name)

    # 上传文件到Azure
    file_client.upload_file(file)

    return 'File Uploaded Successfully'