import os
import sys
import io
from datetime import datetime, timedelta
from flask import render_template, url_for, flash, redirect, request, abort, jsonify, make_response, send_file, session
import requests
from azure.storage.fileshare import ShareClient,ShareDirectoryClient,ShareFileClient,generate_file_sas
from azure.storage.blob import BlobServiceClient, ContentSettings,generate_blob_sas, BlobSasPermissions
from bivwebs import app
from bivwebs.forms import EmailOTPForm
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
import zipfile
from flask_mail import Mail, Message
import secrets
import time
from email.mime.image import MIMEImage
from PIL import Image
import tempfile
import shutil
import subprocess, os
import math, zipfile
import concurrent.futures
from io import BytesIO


# Set a global variable to track progress
progress = {}

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
                    users.update_one({"email": form.email.data}, { "$set": {"lastLogin": datetime.now(), "logins": user['logins']+1}})
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
    ds.update_one({
        "dataset": json["dataset"],
        "slice": json["slice"],
        "text": json["oldText"],
        "instance": int(json["instance"]),
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

    ds.update_one({
        "dataset": json["dataset"],
        "slice": json["slice"],
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
            'name': dataset['name'],
            'institution': dataset['institution'],
            'ponum': dataset['ponum']
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
    return render_template('datasetsV2.html', title='Datasets')

@app.route("/datasetsNew")
def datasetsNew():
    if 'email' not in session:
        return redirect(url_for('login'))
    if session['level'] != 'admin':
        return render_template('403.html'), 403
    return render_template('datasetsV3.html', title='Datasets')

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
    
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    datasets = db.datasets

    dataset_name = request.form['dataset-name']
    modality = request.form['modality']
    exposure = request.form['exposure']
    wavelength = request.form['wavelength']
    axis = request.form['axis']
    voxels_x = request.form['voxels_x']
    voxels_y = request.form['voxels_y']
    voxels_z = request.form['voxels_z']
    ImageDim_x = request.form['ImageDims_x']
    ImageDim_y = request.form['ImageDims_y']
    ImageDim_z = request.form['ImageDims_z']
    Dims2_x = request.form['Dims2_x']
    Dims2_y = request.form['Dims2_y']
    Dims2_z = request.form['Dims2_z']
    Dims3_x = request.form['Dims3_x']
    Dims3_y = request.form['Dims3_y']
    Dims3_z = request.form['Dims3_z']
    pixelLengthUM = request.form['pixelLengthUM']
    zskip = request.form['zskip']
    specimen = request.form['spcimenName']
    PI = request.form['PI']
    voxel_size = request.form['voxel_size']
    thickness = request.form['thickness']
    files = request.files.getlist('files')

    # Save data to MongoDB
    doc = {
        'name': dataset_name,
        'types':{modality:{exposure:[wavelength]}},
        'voxels':{'x':voxels_x,'y':voxels_y,'z':voxels_z},
        'dims2':{'x':Dims2_x,'y': Dims2_y,'z': Dims2_z},
        'dims3':{'x':Dims3_x,'y': Dims3_y,'z': Dims3_z},
        'pixelLengthUM':pixelLengthUM,
        'imageDims':{'x':ImageDim_x,'y':ImageDim_y,'z':ImageDim_z},
        'zskip':zskip,
        'info':{'specimen': specimen,'PI': PI,'voxels': voxel_size,'thickness':thickness},
        
    }
    if not datasets.find_one({'name': dataset_name}):   
        datasets.insert_one(doc)

    # Azure storage account name and account key, these information should be obtained from the Azure portal
    azure_storage_account_name = "bivlargefiles"
    azure_storage_account_key = "PPPXG+UXhU+gyB4WWWjeRMdE4Av8Svfnc9IOPd66hxsnIwx9IpP3C8aj/OA311i1zt+qF/Jkbg4l+AStegZGxw=="
    share = "data"
    # Create Azure ShareFileClient

    # The directory path that needs to be created
    dirs = [dataset_name,"basis", modality, exposure, wavelength, axis]

    # Create a ShareDirectoryClient object and create directories step by step
    dir_path = ""
    for dir_name in dirs:
        dir_path = os.path.join(dir_path, dir_name)
        dir_client = ShareDirectoryClient(account_url=f"https://{azure_storage_account_name}.file.core.windows.net", share_name=share,directory_path=dir_path,credential=azure_storage_account_key)
        if not dir_client.exists():
            dir_client.create_directory()
    else:
        # Parent folder already exists, skip creation
        pass
    # Create a ShareFileClient object and upload files to the specified directory
    for file in files:
        # Assuming the filename is stored in the variable file_name
        file_name = file.filename

        # build file path
        file_path = os.path.join(dir_path, file_name)

        # Create a ShareFileClient object and upload files
        file_client = ShareFileClient(account_url=f"https://{azure_storage_account_name}.file.core.windows.net", share_name=share, file_path=file_path, credential=azure_storage_account_key)
        file_client.upload_file(file)
    
    return jsonify({"message": "File Uploaded Successfully"}), 200


@app.route('/getdatasetsdetail/<name>', methods=['GET'])
def get_dataset(name):
    # print(name)
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    datasets = db.datasets
    dataset = datasets.find_one({'name':name})
    # Make sure the '_id' key is a string
    if dataset is not None and '_id' in dataset:
        dataset['_id'] = str(dataset['_id'])
    return jsonify(dataset)

def po2Dims(mongoRecord,jobNum):
    mongoRecord[jobNum]['dims2'] = {}
    for key in mongoRecord[jobNum]['imageDims']:
        po2 = 128
        while mongoRecord[jobNum]['imageDims'][key] > po2:
                po2 = po2 * 2
        mongoRecord[jobNum]['dims2'][key] = po2

def startProcess(mongoRecord, jobNum, zdown):
    global progress
    # print("startProcess")
    total_tasks = mongoRecord[jobNum]['imageDims']['z'] + (mongoRecord[jobNum]['imageDims']['y'] - 1) // 4 + (mongoRecord[jobNum]['imageDims']['x'] - 1) // 4
    completed_tasks = 0
    # print("startprocess")
    po2Dims(mongoRecord,jobNum)

    maxWorkers = 4
    if mongoRecord[jobNum]['dims2']['x'] > 8192 or mongoRecord[jobNum]['dims2']['y'] > 8192 :
        maxWorkers = 2
    # if option selected?
    os.makedirs(mongoRecord[jobNum]['name'], exist_ok=True)
    
    create3dPngZip(mongoRecord, jobNum, zdown)
    progress['progress'] = 0.1  # 30% done
    #need to remove pngs || or will they be useful for unity?
    os.makedirs(mongoRecord[jobNum]['name'] + '/basis/'+ mongoRecord[jobNum]['type'] + '/' + mongoRecord[jobNum]['exp'] + '/' + mongoRecord[jobNum]['wv'] + '/xy', exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=maxWorkers) as executor:
        for index in range(0, mongoRecord[jobNum]['imageDims']['z']):
            executor.submit(createXyViewTIFF, index, mongoRecord, jobNum)
    #f = 0
    progress['progress'] = 0.3  # 30% done
    #os.remove(f) for f in os.listdir(mongoRecord['name'] + '/basis/'+ args.mod + '/xy/') if f.endswith('.png')
    os.makedirs(mongoRecord[jobNum]['name'] + '/basis/' + mongoRecord[jobNum]['type'] + '/' + mongoRecord[jobNum]['exp'] + '/' + mongoRecord[jobNum]['wv'] + '/xz', exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=maxWorkers) as executor:
        for index in range(0, mongoRecord[jobNum]['imageDims']['y']-1, 4):
            executor.submit(createXzViewTIFF, index, mongoRecord, jobNum)
    progress['progress'] = 0.6  # 50% done
    #for index in range(0, mongoRecord[jobNum]['imageDims']['y']-1, 4):
    #    createXzViewTIFFASync(index, mongoRecord, jobNum)
    #os.remove(file) for file in os.listdir('path/to/directory') if file.endswith('.png')
    os.makedirs(mongoRecord[jobNum]['name'] + '/basis/'+ mongoRecord[jobNum]['type'] + '/' + mongoRecord[jobNum]['exp'] + '/' + mongoRecord[jobNum]['wv'] + '/yz', exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=maxWorkers) as executor:
        for index in range(0, mongoRecord[jobNum]['imageDims']['x']-1, 4):
            executor.submit(createYzViewTIFF, index,mongoRecord, jobNum)
    progress['progress'] = 1  # 100% done

def create3dPngZip(mongoRecord, jobNum, zdown):
    fn = mongoRecord[jobNum]['name'] + '/' + mongoRecord[jobNum]['type'] + '-' + mongoRecord[jobNum]['exp'] + '-' + mongoRecord[jobNum]['wv'] + '.zip'
    zipf = zipfile.ZipFile(fn, 'w', zipfile.ZIP_DEFLATED)
    #3D xy  RESIZE HAS TO HIT TARGET OF 100MB pixel size (100mb * 4|RGBA) = 400mb which is < 500mb (max texture limit)
    pixels = mongoRecord[jobNum]['imageDims']['x'] * mongoRecord[jobNum]['imageDims']['y'] * mongoRecord[jobNum]['imageDims']['z'] #/ zdown
    scale = 1
    if (pixels > 100000000):
        scale = pixels / 100000000
        scale = int(math.sqrt(scale))
    #HARDCODE
    mongoRecord[jobNum]['voxel'] = {}
    mongoRecord[jobNum]['voxel']['x'] = 1
    mongoRecord[jobNum]['voxel']['y'] = 1
    mongoRecord[jobNum]['voxel']['z'] = 1 #* zdown
    
    mongoRecord[jobNum]['dims3'] = {}
    mongoRecord[jobNum]['dims3']['x'] = mongoRecord[jobNum]['imageDims']['x']//scale
    mongoRecord[jobNum]['dims3']['y'] = mongoRecord[jobNum]['imageDims']['y']//scale
    znum = 0
    for z in range( 1, mongoRecord[jobNum]['imageDims']['z'], 1 ):
        file = mongoRecord[jobNum]['fp'] #% z

        tiff = Image.open(BytesIO(file))

        tiff.seek(z)
        im = tiff.resize((mongoRecord[jobNum]['imageDims']['x']//scale, mongoRecord[jobNum]['imageDims']['y']//scale))
        fn = "%d.png" % (znum)
        znum = znum + 1
        im.save(mongoRecord[jobNum]['name'] + '/' + fn)
        zipf.write(mongoRecord[jobNum]['name'] + '/' + fn,fn)
        os.remove(mongoRecord[jobNum]['name'] + '/' + fn)
    zipf.close()

# Create temp_dir, save all .img 
temp_dir = tempfile.mkdtemp()

def createXyViewTIFF(index, mongoRecord, jobNum):
    print("XY")
    filename = mongoRecord[jobNum]['fp'] #% index
    tiff = Image.open(BytesIO(filename))
    tiff.seek(index)
    fn = "%d.png" % (index)
    background = Image.new('RGBA', (mongoRecord[jobNum]['dims2']['x'], mongoRecord[jobNum]['dims2']['y']), (0, 0, 0, 0))
    background.paste(tiff)
    outputPath = os.path.join(temp_dir, mongoRecord[jobNum]['name'], 'basis', mongoRecord[jobNum]['type'], mongoRecord[jobNum]['exp'], mongoRecord[jobNum]['wv'], 'xy/')
    os.makedirs(outputPath, exist_ok=True)
    outputFile = os.path.join(outputPath, fn)
    background.save(outputFile)
    cmd = r'Web-Azure\LATEST-Web-Azure\Web-Azure\bivwebs\basisu.exe -tex_type 2d  -output_path %s -file %s' % (outputPath, outputFile) #-y_flip not a cure
    subprocess.call(cmd)

def createXzViewTIFF(index, mongoRecord, jobNum):
    print("XZ")
    filename = mongoRecord[jobNum]['fp'] #% index #3.7 supports this but not 3.8
    tiff = Image.open(BytesIO(filename))
    #tiff.seek(index)
    fn = "%d.png" % (index)
    background = Image.new('RGBA', (mongoRecord[jobNum]['dims2']['x'], mongoRecord[jobNum]['dims2']['z']), (0, 0, 0, 0))
    for z in range(mongoRecord[jobNum]['imageDims']['z']):
        tiff.seek(z)
        cropped = tiff.crop((0,index,mongoRecord[jobNum]['imageDims']['x'],index+1))
        background.paste(cropped,(0,z,mongoRecord[jobNum]['imageDims']['x'],z+1))	
    outputPath = os.path.join(temp_dir, mongoRecord[jobNum]['name'], 'basis', mongoRecord[jobNum]['type'], mongoRecord[jobNum]['exp'], mongoRecord[jobNum]['wv'], 'xz/')
    os.makedirs(outputPath, exist_ok=True)
    outputFile = os.path.join(outputPath, fn)
    background.save(outputFile)
    cmd = r'Web-Azure\LATEST-Web-Azure\Web-Azure\bivwebs\basisu.exe -tex_type 2d  -output_path %s -file %s' % (outputPath, outputFile) #-y_flip not a cure
    subprocess.call(cmd)

def createYzViewTIFF(index, mongoRecord, jobNum):
    print("YZ")
    filename = mongoRecord[jobNum]['fp'] #% index #3.7 supports this but not 3.8
    tiff = Image.open(BytesIO(filename))
    #tiff.seek(index)
    fn = "%d.png" % (index)
    background = Image.new('RGBA', (mongoRecord[jobNum]['dims2']['y'], mongoRecord[jobNum]['dims2']['z']), (0, 0, 0, 0))
    for z in range(mongoRecord[jobNum]['imageDims']['z']):
        tiff.seek(z)
        cropped = tiff.crop((index,0,index+1,mongoRecord[jobNum]['imageDims']['y']))
        rot = cropped.transpose(method=Image.ROTATE_90)
        background.paste(rot,(0,z,mongoRecord[jobNum]['imageDims']['y'],z+1))	
    outputPath = os.path.join(temp_dir, mongoRecord[jobNum]['name'], 'basis', mongoRecord[jobNum]['type'], mongoRecord[jobNum]['exp'], mongoRecord[jobNum]['wv'], 'yz/')
    os.makedirs(outputPath, exist_ok=True)
    outputFile = os.path.join(outputPath, fn)
    background.save(outputFile)
    cmd = r'Web-Azure\LATEST-Web-Azure\Web-Azure\bivwebs\basisu.exe -tex_type 2d  -output_path %s -file %s' % (outputPath, outputFile) #-y_flip not a cure
    subprocess.call(cmd)   

# Set a global variable to track progress
@app.route('/UploadDataset', methods=['POST'])
def driver():
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    datasets = db.datasets
    global progress
    progress = {'status': 'started', 'progress': 0.0}
    # Reset progress at the start of a new job
    data = request.form
    dataset_name = data.get('dataset-name')
    # voxels_x = data.get('voxels_x')
    # voxels_y = data.get('voxels_y')
    # voxels_z = data.get('voxels_z')
    # Dims2_x = data.get('Dims2_x')
    # Dims2_y = data.get('Dims2_y')
    # Dims2_z = data.get('Dims2_z')
    # Dims3_x = data.get('Dims3_x')
    # Dims3_y = data.get('Dims3_y')
    # Dims3_z = data.get('Dims3_z')
    pixelLengthUM = data.get('pixelLengthUM')
    zskip = data.get('zskip')
    specimen = data.get('spcimenName')
    PI = data.get('PI')
    voxel_size = data.get('voxel_size')
    thickness = data.get('thickness')
    Modality = data.get('modality')
    exposure = data.get('exposure')
    wavelength = data.get('wavelength')
    # Extract Tiff content
    file = request.files['fileContent']
    file_content = file.read()

    jobs = {}
    jobs[1] = [dataset_name, Modality, exposure, wavelength, file_content]
    # print("jobs1",jobs[1])
    mongoRecord = {}

    for job in jobs.items():
        mongoRecord[str(job[0])] = {}
        if(job[0] > 1):
            print('Considering just sorting mongorecord at the end')
        else:
            mongoRecord[str(job[0])]['name'] = job[1][0]
            firstFile = job[1][4] #% 1  
            
            # print("firstFile",firstFile)
            tiff = Image.open(BytesIO(firstFile))
            tifCounter = tiff.n_frames
            # print("tifCounter",tifCounter)
            mongoRecord[str(job[0])]['imageDims'] = {}
            mongoRecord[str(job[0])]['imageDims']['x'], mongoRecord[str(job[0])]['imageDims']['y'] = tiff.size
            mongoRecord[str(job[0])]['imageDims']['z'] = tifCounter
            mongoRecord[str(job[0])]['type'] = job[1][1] #bf or fl
            mongoRecord[str(job[0])]['exp'] = job[1][2] #exp
            mongoRecord[str(job[0])]['wv'] = job[1][3] #wv
            print("mongoRecord",mongoRecord)
            mongoRecord[str(job[0])]['fp'] = job[1][4]
            startProcess(mongoRecord, str(job[0]), 1 )

        mongoRecord[str(job[0])]["processedTime"] = datetime.now().time()
        # print("mongoRecord",mongoRecord)
        base_dir = os.path.join(temp_dir, mongoRecord[str(job[0])]['name'],'basis', mongoRecord[str(job[0])]['type'], mongoRecord[str(job[0])]['exp'], mongoRecord[str(job[0])]['wv'])
        files_and_dirs = os.listdir(base_dir)

        # Save data to MongoDB
        doc = {
            'name': dataset_name,
            'types':{Modality:{
                exposure:[wavelength]
                            }
                    },
            'voxels':{'x':1,'y':1,'z':2.048},
            'dims2':{'x':int(mongoRecord[str(job[0])]['imageDims']['x'] * 2),'y': int(mongoRecord[str(job[0])]['imageDims']['y'] * 2),'z': int(mongoRecord[str(job[0])]['imageDims']['z'] * 2)},
            'dims3':{'x':int(mongoRecord[str(job[0])]['imageDims']['x']),'y': int(mongoRecord[str(job[0])]['imageDims']['y']),'z': int(mongoRecord[str(job[0])]['imageDims']['z'])},
            'pixelLengthUM':"100.5",
            'imageDims':{'x':mongoRecord[str(job[0])]['imageDims']['x'],'y':mongoRecord[str(job[0])]['imageDims']['y'],'z':mongoRecord[str(job[0])]['imageDims']['z']},
            'zskip':zskip,
            'info':{'specimen': specimen,'PI': PI,'voxels': voxel_size,'thickness':thickness},
        }
    if not datasets.find_one({'name': dataset_name}):   
        datasets.insert_one(doc)
    else:
        query = {'name': dataset_name}
        types_key = f"types.{Modality}"
        # 
        exposure_key = f"{types_key}.{exposure}" 

        # 
        update = {
            "$set": {
                exposure_key: [wavelength]
        }
    }
        # 
        datasets.update_one(query, update, upsert=True)

    # Azure storage account name and account key, these information should be obtained from the Azure portal
    azure_storage_account_name = "bivlargefiles"
    azure_storage_account_key = "PPPXG+UXhU+gyB4WWWjeRMdE4Av8Svfnc9IOPd66hxsnIwx9IpP3C8aj/OA311i1zt+qF/Jkbg4l+AStegZGxw=="
    share = "data"
    # Create Azure ShareFileClient

    # The directory path that needs to be created

    for item in files_and_dirs:
        filesNameList = os.listdir(os.path.join(base_dir, item))
        dir_s = [dataset_name,"basis", Modality, exposure, wavelength, item]

        # Create a ShareDirectoryClient object and create directories step by step
        dir_path = ""
        for dir_name in dir_s:
            dir_path = os.path.join(dir_path, dir_name)
            dir_client = ShareDirectoryClient(account_url=f"https://{azure_storage_account_name}.file.core.windows.net", share_name=share,directory_path=dir_path,credential=azure_storage_account_key)
            if not dir_client.exists():
                dir_client.create_directory()
            else:
            # Parent folder already exists, skip creation
                pass
        # Create a ShareFileClient object and upload files to the specified directory

        for file_name in filesNameList:
            fileExtension = file_name.split(".")[-1]
            if fileExtension != 'basis': 
                continue

            # build file path
            file_path = os.path.join(dir_path, file_name)
            # Create a ShareFileClient object and upload files
            
            file_client = ShareFileClient(account_url=f"https://{azure_storage_account_name}.file.core.windows.net", share_name=share, file_path=file_path, credential=azure_storage_account_key)
            file_path_local = os.path.join(os.path.join(base_dir, item), file_name)
            with open(file_path_local, 'rb') as file:
                content = file.read()
            file_client.upload_file(content)

    compressed_file_path = dataset_name +"-" + Modality + "-" + exposure + "-" + wavelength + ".zip"
    shutil.make_archive(compressed_file_path[:-4], 'zip', temp_dir)
    blob_name = os.path.basename(compressed_file_path)

    AZURE_CONNECTION_STRING = "DefaultEndpointsProtocol=https;AccountName=bivlargefiles;AccountKey=PPPXG+UXhU+gyB4WWWjeRMdE4Av8Svfnc9IOPd66hxsnIwx9IpP3C8aj/OA311i1zt+qF/Jkbg4l+AStegZGxw==;EndpointSuffix=core.windows.net"
    CONTAINER_NAME = "zipfiles"
    blob_service_client = BlobServiceClient.from_connection_string(AZURE_CONNECTION_STRING)
    container_client = blob_service_client.get_container_client(CONTAINER_NAME)
    blob_client = container_client.get_blob_client(blob_name)
    with open(compressed_file_path, "rb") as f:
        blob_client.upload_blob(f)

    return jsonify({"message": "File Uploaded Successfully"}), 200

@app.route('/progress', methods=['GET'])
def get_progress():
    try:
        global progress
        return jsonify(progress)
    except Exception as e:
        return jsonify(error=str(e)), 500

@app.route('/getDatasetsData', methods=['POST'])
def get_datasetsData():
    dataset_name = request.json['datasetName']
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    ds = db.datasets
    # Assume that each dataset has a "name" field to store its name
    dataset_data = ds.find({"name": dataset_name})
    # Convert data to serializable format
    data = []
    for doc in dataset_data:
        # MongoDB's ObjectId field needs to be removed or converted to a string before being returned because it cannot be serialized directly to JSON
        doc['_id'] = str(doc['_id'])
        data.append(doc)

    return jsonify(data)

# Under developing
@app.route('/downloadDataset', methods=['POST'])
def download_file():
    dataset_name = request.json['datasetName']
    azure_storage_account_name = "bivlargefiles"
    azure_storage_account_key = "PPPXG+UXhU+gyB4WWWjeRMdE4Av8Svfnc9IOPd66hxsnIwx9IpP3C8aj/OA311i1zt+qF/Jkbg4l+AStegZGxw=="
    container_name = "zipfiles"
    # InitializeBlobServiceClient
    blob_service_client = BlobServiceClient(account_url=f"https://{azure_storage_account_name}.blob.core.windows.net", credential=azure_storage_account_key)
    
    # List of blobs
    all_blobs = blob_service_client.get_container_client(container_name).list_blobs(name_starts_with=dataset_name)

    # Filter out blobs that contain dataset_name and are .zips
    zip_blobs = [blob for blob in all_blobs if blob.name.endswith('.zip')]

    download_urls = []
    for blob in zip_blobs:
        sas_token = generate_blob_sas(account_name=azure_storage_account_name,
                                      container_name=container_name,
                                      blob_name=blob.name,
                                      account_key=azure_storage_account_key,
                                      permission="r",
                                      expiry=datetime.utcnow() + timedelta(hours=1))

        download_url = f"https://{azure_storage_account_name}.blob.core.windows.net/{container_name}/{blob.name}?{sas_token}"
        download_urls.append(download_url)
    # print(download_urls)
    return jsonify({'download_urls': download_urls})

@app.route('/deleteDataset', methods=['POST'])
def delete_dataset():
    dataset_name = request.json['datasetName']
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    datasets = db.datasets
    user = db.Users
    user.update_many(
        {"datasets": {"$in": [dataset_name]}},
        {"$pull": {"datasets": dataset_name}}
    )
    datasets.delete_one({"name": dataset_name})
    send = '{ "success": "cookie"}'
    return jsonify({'status': 'success', 'message': 'Delete successfully'})

# 更新数据集信息的路由
@app.route('/updateDataset', methods=['POST'])
def update_dataset():
    try:
        data = request.json
        client = MongoClient(app.config['mongo'])
        db = client.BIV 
        print(data)
        # 在实际应用中，你可以根据 dataset_id 来查找并更新对应的数据集信息
        # 这里只是一个简单的示例，假设你有一个名为 "datasets" 的集合
        update_result = db.datasets.update_one(
        {"name": data.get('name')},
        {"$set": {
            "name": data.get('name'),
            "institution": data.get('institution'),
            "ponum":data.get("ponum"),
            "voxels.x": float(data.get('voxels[x]')),
            "voxels.y": float(data.get('voxels[y]')),
            "voxels.z": float(data.get('voxels[z]')),
            "dims3.x": float(data.get('dims3[x]')),
            "dims3.y": float(data.get('dims3[y]')),
            "dims3.z": float(data.get('dims3[z]')),
            "dims2.x": float(data.get('dims2[x]')),
            "dims2.y": float(data.get('dims2[y]')),
            "dims2.z": float(data.get('dims2[z]')),
            "pixelLengthUM": data.get('pixelLengthUM'),
            "zskip":float(data.get('zskip')),
            "info.specimen":data.get('info[specimen]'),
            "info.PI":data.get('info[PI]'),
            "info.thickness":data.get('info[thickness]'),
            "info.voxels":data.get('info[voxels]')
        }}
    )

        if update_result.modified_count > 0:
            return jsonify({'status': 'success', 'message': 'Dataset updated successfully'}), 200
        else:
            return jsonify({'status': 'error', 'message': 'No dataset updated'}), 404

    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/getInstitutions', methods=['GET'])
def get_institutions():
    institutions = []
    client = MongoClient(app.config['mongo'])
    db = client.BIV
    collection = db.Institution  # 假设机构数据存储在'institutions'集合中
    # print(collection)
    for institution in collection.find():
        print(institution)
        institutions.append({
            # 'id': str(institution['_id']),  # MongoDB的_id字段是ObjectId类型，需要转换为字符串
            'name': institution.get('name', ''),
            'type': institution.get('type', ''),
            'address': institution.get('address', ''),
            'phone': institution.get('phone',''),
            'Email': institution.get('Email',''),
            'website': institution.get('website',''),
            'status': institution.get('status','')
        })
    return jsonify(institutions)

@app.route('/updateInstitution', methods=['POST'])
def update_institution():
    data = request.json
    client = MongoClient(app.config['mongo'])
    db = client.BIV

    print("打印",data)
    
    institution_name = data.get('name')
    if not institution_name:
        return jsonify({"error": "Missing institution name"}), 400

    # 检查机构是否存在
    existing_institution = db.Institution.find_one({"name": institution_name})

    if existing_institution:
        # 如果机构存在，则更新
        update_result = db.Institution.update_one(
            {"name": institution_name},
            {"$set": {
                "name": data.get('name'),
                "type": data.get('type'),
                "address": data.get('address'),
                "phone": data.get('phone'),
                "website": data.get('website'),
                "Email": data.get('Email'),
                "status": data.get('status'),
            }}
        )
        if update_result.modified_count > 0:
            return jsonify({"success": True}), 200
        else:
            return jsonify({"error": "No institution updated"}), 404
    else:
        # 如果机构不存在，则插入新数据
        insert_result = db.Institution.insert_one({
                "name": data.get('name'),
                "type": data.get('type'),
                "address": data.get('address'),
                "phone": data.get('phone'),
                "website": data.get('website'),
                "Email": data.get('Email'),
                "status": data.get('status'),
        })
        if insert_result.inserted_id:
            return jsonify({"success": True, "message": "New institution added"}), 201
        else:
            return jsonify({"error": "Failed to add new institution"}), 500
