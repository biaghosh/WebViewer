#Script to resize images to power of two dimensions for BASIS compression/WEBGL and generate 3D file(s)
#Author: Brian Powell
from PIL import Image
import subprocess, timeit, argparse, os, json
import math, zipfile
import threading
import concurrent.futures
import pandas as pd, numpy as np 
import glob
from datetime import datetime

def startProcess(mongoRecord, jobNum, zdown):
    print("startprocess")
    po2Dims(mongoRecord,jobNum)

    maxWorkers = 4
    if mongoRecord[jobNum]['dims2']['x'] > 8192 or mongoRecord[jobNum]['dims2']['y'] > 8192 :
        maxWorkers = 2
    # if option selected?
    os.makedirs(mongoRecord[jobNum]['name'], exist_ok=True)
    
    create3dPngZip(mongoRecord, jobNum, zdown)
    #need to remove pngs || or will they be useful for unity?
    os.makedirs(mongoRecord[jobNum]['name'] + '/basis/'+ mongoRecord[jobNum]['type'] + '/' + mongoRecord[jobNum]['exp'] + '/' + mongoRecord[jobNum]['wv'] + '/xy', exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=maxWorkers) as executor:
        for index in range(0, mongoRecord[jobNum]['imageDims']['z']):
            executor.submit(createXyViewTIFF, index, mongoRecord, jobNum)
    #f = 0
    
    #os.remove(f) for f in os.listdir(mongoRecord['name'] + '/basis/'+ args.mod + '/xy/') if f.endswith('.png')
    os.makedirs(mongoRecord[jobNum]['name'] + '/basis/' + mongoRecord[jobNum]['type'] + '/' + mongoRecord[jobNum]['exp'] + '/' + mongoRecord[jobNum]['wv'] + '/xz', exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=maxWorkers) as executor:
        for index in range(0, mongoRecord[jobNum]['imageDims']['y']-1, 4):
            executor.submit(createXzViewTIFF, index, mongoRecord, jobNum)
    #for index in range(0, mongoRecord[jobNum]['imageDims']['y']-1, 4):
    #    createXzViewTIFFASync(index, mongoRecord, jobNum)
    #os.remove(file) for file in os.listdir('path/to/directory') if file.endswith('.png')
    os.makedirs(mongoRecord[jobNum]['name'] + '/basis/'+ mongoRecord[jobNum]['type'] + '/' + mongoRecord[jobNum]['exp'] + '/' + mongoRecord[jobNum]['wv'] + '/yz', exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=maxWorkers) as executor:
        for index in range(0, mongoRecord[jobNum]['imageDims']['x']-1, 4):
            executor.submit(createYzViewTIFF, index,mongoRecord, jobNum)
            
    #os.remove(file) for file in os.listdir('path/to/directory') if file.endswith('.png')

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
        filename = mongoRecord[jobNum]['fp'] #% z
        tiff = Image.open(filename)
        tiff.seek(z)
        im = tiff.resize((mongoRecord[jobNum]['imageDims']['x']//scale, mongoRecord[jobNum]['imageDims']['y']//scale))
        fn = "%d.png" % (znum)
        znum = znum + 1
        im.save(mongoRecord[jobNum]['name'] + '/' + fn)
        zipf.write(mongoRecord[jobNum]['name'] + '/' + fn,fn)
        os.remove(mongoRecord[jobNum]['name'] + '/' + fn)
    zipf.close()

def createXyViewTIFF(index, mongoRecord, jobNum):
    print("xy合成")
    filename = mongoRecord[jobNum]['fp'] #% index
    tiff = Image.open(filename)
    tiff.seek(index)
    fn = "%d.png" % (index)
    background = Image.new('RGBA', (mongoRecord[jobNum]['dims2']['x'], mongoRecord[jobNum]['dims2']['y']), (0, 0, 0, 0))
    background.paste(tiff)
    outputPath = mongoRecord[jobNum]['name'] + '/basis/'+ mongoRecord[jobNum]['type'] + '/' + mongoRecord[jobNum]['exp'] + '/' + mongoRecord[jobNum]['wv'] + '/xy/'
    outputFile = outputPath + fn
    background.save(outputFile)
    cmd = 'basisu.exe -tex_type 2d  -output_path %s -file %s' % (outputPath, outputFile) #-y_flip not a cure
    subprocess.call(cmd)

def createXzViewTIFF(index, mongoRecord, jobNum):
    
    filename = mongoRecord[jobNum]['fp'] #% index #3.7 supports this but not 3.8
    tiff = Image.open(filename)
    #tiff.seek(index)
    fn = "%d.png" % (index)
    background = Image.new('RGBA', (mongoRecord[jobNum]['dims2']['x'], mongoRecord[jobNum]['dims2']['z']), (0, 0, 0, 0))
    for z in range(mongoRecord[jobNum]['imageDims']['z']):
        tiff.seek(z)
        cropped = tiff.crop((0,index,mongoRecord[jobNum]['imageDims']['x'],index+1))
        background.paste(cropped,(0,z,mongoRecord[jobNum]['imageDims']['x'],z+1))	
    outputPath = mongoRecord[jobNum]['name'] + '/basis/'+ mongoRecord[jobNum]['type'] + '/' + mongoRecord[jobNum]['exp'] + '/' + mongoRecord[jobNum]['wv'] + '/xz/'
    outputFile = outputPath + fn
    background.save(outputFile)
    cmd = 'basisu.exe -tex_type 2d  -output_path %s -file %s' % (outputPath, outputFile) #-y_flip not a cure
    subprocess.call(cmd)

def createYzViewTIFF(index, mongoRecord, jobNum):
    print("YZ合成!")
    filename = mongoRecord[jobNum]['fp'] #% index #3.7 supports this but not 3.8
    tiff = Image.open(filename)
    #tiff.seek(index)
    fn = "%d.png" % (index)
    background = Image.new('RGBA', (mongoRecord[jobNum]['dims2']['y'], mongoRecord[jobNum]['dims2']['z']), (0, 0, 0, 0))
    for z in range(mongoRecord[jobNum]['imageDims']['z']):
        tiff.seek(z)
        cropped = tiff.crop((0,index,mongoRecord[jobNum]['imageDims']['y'],index+1))
        background.paste(cropped,(0,z,mongoRecord[jobNum]['imageDims']['y'],z+1))	
    outputPath = mongoRecord[jobNum]['name'] + '/basis/'+ mongoRecord[jobNum]['type'] + '/' + mongoRecord[jobNum]['exp'] + '/' + mongoRecord[jobNum]['wv'] + '/yz/'
    outputFile = outputPath + fn
    background.save(outputFile)
    cmd = 'basisu.exe -tex_type 2d  -output_path %s -file %s' % (outputPath, outputFile) #-y_flip not a cure
    subprocess.call(cmd)   

# def createYzViewTIFF(index):
#     #initalize tiff here to avoid race conditions
#     tiff = Image.open(mongoRecord[jobNum]['fp'])
#     #yz
#     i = index
#     imgX = Image.new('RGBA',(mongoRecord['dims2']['y'],mongoRecord['dims2']['z']),color=(0,0,0,0))
#     for z in range(mongoRecord['dims']['z']):
#         tiff.seek(z)
#         cropped = tiff.crop((i,0,i+1,mongoRecord['dims']['y']))
#         rot = cropped.transpose(method=Image.ROTATE_90) #270 if xy isn't flipped
#         #imgX.paste(rot,(0,mongoRecord['dims']['z'] - z,mongoRecord['dims']['y'],mongoRecord['dims']['z'] - z+1))
#         imgX.paste(rot,(0,z,mongoRecord['dims']['y'],z+1)) 
#     fn = "%d.png" % (i)
#     outputPath = mongoRecord[jobNum]['name'] + '/basis/'+ mongoRecord[jobNum]['type'] + '/' + mongoRecord[jobNum]['exp'] + '/' + mongoRecord[jobNum]['wv'] + '/yz/'
#     outputFile = outputPath + fn
#     imgX.save(outputFile)
#     cmd = 'basisu.exe -tex_type 2d -output_path %s -file %s' % (outputPath, outputFile)
#     subprocess.call(cmd)

def createXzViewTIFFASync(index, mongoRecord, jobNum):
    
    filename = mongoRecord[jobNum]['fp'] #% index #3.7 supports this but not 3.8
    tiff = Image.open(filename)
    #tiff.seek(index)
    fn = "%d.png" % (index)
    background = Image.new('RGBA', (mongoRecord[jobNum]['dims2']['x'], mongoRecord[jobNum]['dims2']['z']), (0, 0, 0, 0))
    for z in range(mongoRecord[jobNum]['imageDims']['z']):
        tiff.seek(z)
        cropped = tiff.crop((0,index,mongoRecord[jobNum]['imageDims']['x'],index+1))
        background.paste(cropped,(0,z,mongoRecord[jobNum]['imageDims']['x'],z+1))	
    outputPath = mongoRecord[jobNum]['name'] + '/basis/'+ mongoRecord[jobNum]['type'] + '/' + mongoRecord[jobNum]['exp'] + '/' + mongoRecord[jobNum]['wv'] + '/xz/'
    outputFile = outputPath + fn
    background.save(outputFile)
    cmd = 'basisu.exe -tex_type 2d  -output_path %s -file %s' % (outputPath, outputFile) #-y_flip not a cure
    subprocess.call(cmd)

def po2Dims(mongoRecord,jobNum):
    mongoRecord[jobNum]['dims2'] = {}
    for key in mongoRecord[jobNum]['imageDims']:
        po2 = 128
        while mongoRecord[jobNum]['imageDims'][key] > po2:
                po2 = po2 * 2
        mongoRecord[jobNum]['dims2'][key] = po2

def driver():
    jobs = {}
    with open(args.inputfile) as fp:
        for cnt, line in enumerate(fp):
            if cnt != 0:
                jobs[cnt] = line.split('|')
    mongoRecord = {}
    for job in jobs.items():
        print("job: ", job)
        print('Starting to process: ' + str(job[0])) #[0] job number, [1] array
        print("job0: ",job[0])
        mongoRecord[str(job[0])] = {}
        if(job[0] > 1):
            print('Considering just sorting mongorecord at the end')
        else:
            mongoRecord[str(job[0])]['name'] = job[1][0]
            firstFile = job[1][4] + job[1][5] #% 1  
            
            print(firstFile)
            tiff = Image.open(firstFile)
            #tifCounter = len(glob.glob1(job[1][4],"*.tif")) 3.7 version
            tifCounter = tiff.n_frames
            #print(tiff.n_frames)
            mongoRecord[str(job[0])]['imageDims'] = {}
            mongoRecord[str(job[0])]['imageDims']['x'], mongoRecord[str(job[0])]['imageDims']['y'] = tiff.size
            mongoRecord[str(job[0])]['imageDims']['z'] = tifCounter
            mongoRecord[str(job[0])]['type'] = job[1][1] #bf or fl
            mongoRecord[str(job[0])]['exp'] = job[1][2] #exp
            mongoRecord[str(job[0])]['wv'] = job[1][3] #wv
            mongoRecord[str(job[0])]['fp'] = job[1][4] + job[1][5]
            #mongoRecord[str(job[0])]['zdown'] = 1 #not used yet
            startProcess(mongoRecord, str(job[0]), 1 )

        mongoRecord[str(job[0])]["processedTime"] = datetime.now().time()
        dbFilename = mongoRecord[str(job[0])]['name'] + '.json'
        #with open(dbFilename,'w') as f:
        #    json.dump(mongoRecord, f) 
    
    
    #print out cost estimate size of dir * GB rate
    #Read metadata file
    

parser = argparse.ArgumentParser(description='Generate files and db records for web upload.')
parser.add_argument('-i', '--inputfile', help='text file containing datasets to be processed')
args = parser.parse_args()
driver()