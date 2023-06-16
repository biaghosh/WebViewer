clear;
clc;
datasetName = 'MouseTest';
modality = 'Brightfield';
exposure = '2';
wavelength = 'NA';
filePath = 'C:\Users\Gargesha\Documents\bioinvision\IMPORTANT DOCS\TYLER SOURCE CODE\generateWebFiles\';
fileName = 'small_test.tif';
skipFactorXY = 1;
skipFactorXZ = 1;
skipFactorYZ = 1;

thisInfo = imfinfo([filePath,fileName]);
numImages = length(thisInfo);
mkdir([datasetName,'\',modality,'\',exposure,'\',wavelength]);
mainDir = [datasetName,'\',modality,'\',exposure,'\',wavelength,'\'];

mkdir(mainDir,'xy');
thisDir_noslash = [mainDir,'xy'];
thisDir = [mainDir,'xy\'];
imageVolume = zeros(thisInfo(1).Height,thisInfo(1).Width,numImages,3,'uint8');
for i = 1:skipFactorXY:numImages
    i
    thisImg = imread([filePath,fileName],'Info',thisInfo,'Index',i);
    thisImg = thisImg(:,:,1:3);
    imwrite(thisImg,[pwd,'\',thisDir,num2str(i),'.png'],'png');
    cmd = ['start /b basisu.exe -tex_type 2d  -output_path "',pwd,'\',thisDir_noslash,'"',' -file "',pwd,'\',thisDir,num2str(i),'.png"']; 
    system(cmd);
    imageVolume(:,:,i,:) = thisImg;
end

mkdir(mainDir,'yz');
thisDir_noslash = [mainDir,'yz'];
thisDir = [mainDir,'yz\'];
for i = 1:skipFactorYZ:size(imageVolume,2)
    i
    thisImg = squeeze(imageVolume(:,i,:,:));    
    imwrite(thisImg,[pwd,'\',thisDir,num2str(i),'.png'],'png');
    cmd = ['start /b basisu.exe -tex_type 2d  -output_path "',pwd,'\',thisDir_noslash,'"',' -file "',pwd,'\',thisDir,num2str(i),'.png"']; 
    system(cmd);
end

mkdir(mainDir,'xz');
thisDir_noslash = [mainDir,'xz'];
thisDir = [mainDir,'xz\'];
for i = 1:skipFactorXZ:size(imageVolume,1)
    i
    thisImg = squeeze(imageVolume(i,:,:,:));    
    imwrite(thisImg,[pwd,'\',thisDir,num2str(i),'.png'],'png');
    cmd = ['start /b basisu.exe -tex_type 2d  -output_path "',pwd,'\',thisDir_noslash,'"',' -file "',pwd,'\',thisDir,num2str(i),'.png"']; 
    system(cmd);
end
    
    
    
