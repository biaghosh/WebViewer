import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r119/three.module.min.js'
import { BasisTextureLoader } from 'https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/loaders/BasisTextureLoader.js'
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/controls/OrbitControls.js'
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/webxr/VRButton.js'
import { TransformControls } from 'https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/controls/TransformControls.js'


let dsInfo
let rendererWidth
let mainDiv = document.getElementById('mainCard')
const lRenderer = new THREE.WebGLRenderer()
lRenderer.setSize( 100, 640 )
mainDiv.appendChild( lRenderer.domElement )
const rRenderer = new THREE.WebGLRenderer()
rRenderer.setSize( 100, 640 )
mainDiv.appendChild( rRenderer.domElement )

let lScene, lCamera, lMaterial, lControls, lAnimationId, lGeom, lMesh,
    rScene, rCamera, rMaterial, rControls, rAnimationId, rGeom, rMesh


function init() {

    lRenderer.outputEncoding = THREE.sRGBEncoding
    rRenderer.outputEncoding = THREE.sRGBEncoding
    lCamera = new THREE.OrthographicCamera( 
                                            lRenderer.domElement.width / -2 ,
                                            lRenderer.domElement.width / 2 ,
                                            lRenderer.domElement.height / 2,
                                            lRenderer.domElement.height / - 2, 1, 8000 
                                        )
    rCamera = new THREE.OrthographicCamera( 
                                            rRenderer.domElement.width / -2 ,
                                            rRenderer.domElement.width / 2 ,
                                           rRenderer.domElement.height / 2,
                                            rRenderer.domElement.height / - 2, 1, 8000 
                                        )
    
    lControls = new OrbitControls( lCamera, lRenderer.domElement )
    rControls = new OrbitControls( rCamera, rRenderer.domElement )

    lScene = new THREE.Scene()
    rScene = new THREE.Scene()    
    
    lGeom = new THREE.BoxBufferGeometry( dsInfo['dims3']['x'], dsInfo['dims3']['y'], dsInfo['dims3']['z'] + 200)
    rGeom = new THREE.BoxBufferGeometry( dsInfo['dims3']['x'], dsInfo['dims3']['y'], dsInfo['dims3']['z'] + 200)
    
    lCamera.position.set( dsInfo['dims3']['x'], dsInfo['dims3']['y'], dsInfo['dims3']['x'])
    rCamera.position.set( dsInfo['dims3']['x'], dsInfo['dims3']['y'], dsInfo['dims3']['x'])
    
    lControls.target.set(
        dsInfo['dims3']['x'] / 2 ,
        dsInfo['dims3']['y'] / 2 ,
        dsInfo['dims3']['z']  * dsInfo['voxels']['z'] / ( dsInfo['imageDims']['x'] / dsInfo['dims3']['x']) / 2
    )
    rControls.target.set(
        dsInfo['dims3']['x'] / 2 ,
       dsInfo['dims3']['y'] / 2 ,
        dsInfo['dims3']['z']  * dsInfo['voxels']['z'] / ( dsInfo['imageDims']['x'] / dsInfo['dims3']['x']) / 2
    )
    lControls.update()
    rControls.update()

    lGeom.translate( 
        dsInfo['dims3']['x'] / 2 - 0.5,
        dsInfo['dims3']['y'] / 2 - 0.5,
        dsInfo['dims3']['z']  * dsInfo['voxels']['z'] / ( dsInfo['imageDims']['x'] / dsInfo['dims3']['x']) / 2 - 0.5 
    ) //to center the mesh in the geometry
    rGeom.translate( 
        dsInfo['dims3']['x'] / 2 - 0.5,
        dsInfo['dims3']['y'] / 2 - 0.5,
        dsInfo['dims3']['z']  * dsInfo['voxels']['z'] / ( dsInfo['imageDims']['x'] / dsInfo['dims3']['x']) / 2 - 0.5 
    ) //to center the mesh in the geometry
    
    lControls.addEventListener( 'change', () => {
        rCamera.position.x = lCamera.position.x
        rCamera.position.y = lCamera.position.y
        rCamera.position.z = lCamera.position.z
        rCamera.zoom = lCamera.zoom
        rCamera.updateProjectionMatrix();
        rControls.target.set(lControls.target.x,lControls.target.y,lControls.target.z)
        rControls.update()
    } )

    /* Cyclical code, not sure how to fix
    rControls.addEventListener( 'change', () => {
        lCamera.position.x = rCamera.position.x
        lCamera.position.y = rCamera.position.y
        lCamera.position.z = rCamera.position.z
        lCamera.zoom = rCamera.zoom
        lCamera.updateProjectionMatrix();
        lControls.target.set(rControls.target.x,rControls.target.y,rControls.target.z)
        lControls.update()
    } ) */


    loadBioVisionModal()
    loadSecondaryModal()
}

function loadBioVisionModal(){
    var dataSize = dsInfo['dims3']['x'] * dsInfo['dims3']['y'] * ( dsInfo['dims3']['z'] + 1 ) * 4 //1 == 0offset,4 == RGBA
    var dataSliceSize = dsInfo['dims3']['x'] * dsInfo['dims3']['y'] * 4
        
    var binaryData = new Uint8Array(dataSize)

    var text3d = new THREE.DataTexture3D(binaryData,dsInfo['dims3']['x'],dsInfo['dims3']['y'],dsInfo['dims3']['z'])
        text3d.format = THREE.RGBAFormat
        text3d.type = THREE.UnsignedByteType
        text3d.center = new THREE.Vector2(.5,.5)
        text3d.minFilter = text3d.magFilter = THREE.LinearFilter
        text3d.unpackAlignment = 1

    var cellDataSize = dsInfo['dims3']['x'] * dsInfo['dims3']['y'] * ( dsInfo['dims3']['z'] + 1 ) * 1 //1 == 0offset, 1 == Greyscale
    let cellBinaryData = new Uint8Array(cellDataSize)
    let cellText3d = new THREE.DataTexture3D(cellBinaryData,dsInfo['dims3']['x'],dsInfo['dims3']['y'],dsInfo['dims3']['z'])
    //    //text3d.type = THREE.UnsignedByteType default
        cellText3d.format = THREE.LuminanceFormat
        cellText3d.center = new THREE.Vector2(.5,.5)
        cellText3d.minFilter = text3d.magFilter = THREE.LinearFilter
        
    //    text3d.unpackAlignment = 1
    let modFloat = '1.' // 0: BL, 1: FL
    //if ( modSelect.value == 'Brightfield')
    //    modFloat = '0' 
    
    var shader = VolumeRenderShader1;
    var uniforms = THREE.UniformsUtils.clone( shader.uniforms );
    uniforms[ "u_data" ].value = text3d;
    uniforms[ "u_size" ].value = new THREE.Vector3( 
                                                    dsInfo['dims3']['x'], dsInfo['dims3']['y'],
                                                    dsInfo['dims3']['z'] * dsInfo['voxels']['z'] / ( dsInfo['imageDims']['x'] / dsInfo['dims3']['x'])
                                                    )
    uniforms[ "u_clip" ].value = new THREE.Vector3( 0, 0, 0 )
    let scale =  dsInfo['imageDims']['x'] / dsInfo['dims3']['x']
    uniforms[ "u_clipValues" ].value = new THREE.Vector3( 
                                                        0.,
                                                        0.,
                                                        0.
                                                        )
    uniforms[ "u_renderstyle" ].value = '2' // 0: MIP, 1: ISO , 2: Surface
    uniforms[ "u_modalType" ].value = 0.
    uniforms[ "u_renderthreshold" ].value = 0.15; // For ISO renderstyle
    uniforms[ "u_threshold" ].value = 0.1; 
    uniforms[ "u_background" ].value = new THREE.Vector4( 255, 255, 255, 255 ) // 0 0 255 for blue
    uniforms[ "u_cell" ].value = 0.
    uniforms[ "u_cellData" ] = cellText3d//no matter the clip render flourenscent cells
    
    lMaterial = new THREE.ShaderMaterial( {
        uniforms: uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        side: THREE.BackSide // The volume shader uses the backface as its "reference point"
    } )
    lMaterial.alphaTest = 0.5
    lMesh = new THREE.Mesh( lGeom, lMaterial )
    let zCounter = 0
    
    
    new JSZip.external.Promise(function (resolve, reject) {
        
        JSZipUtils.getBinaryContent(
            `./static/cryoData/${dsInfo['name']}/Brightfield-1-430.zip`
            , function(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    }).then(function (data) {
        
        JSZip.loadAsync(data).then(function (zip) {
            Object.keys(zip.files).forEach(function (filename) {
              zip.files[filename].async('base64').then(function (fileData) {
                let can = new Image()
                can.src = 'data:image/png;base64,'+fileData
                can.onload = function () {
                    
                    let c = document.createElement('canvas')
                    c.width = dsInfo['dims3']['x']
                    c.height = dsInfo['dims3']['y']
                    let ctx = c.getContext('2d')
                    ctx.drawImage(this, 0, 0, dsInfo['dims3']['x'], dsInfo['dims3']['y'])
                    let index = Number(filename.split('.')[0])
                    text3d.needsUpdate = true
                    binaryData.set(ctx.getImageData(0,0, dsInfo['dims3']['x'], dsInfo['dims3']['y']).data,(index * dataSliceSize))
                    zCounter++
                    if (zCounter == dsInfo["dims3"]["z"] - 1){
                        lMesh.visible = true
                        zCounter = 0
                    }
                        
                }
              })
            })
        })
    }) 
    
    lMesh.visible = false
    lMesh.renderOrder = 1.0 //draws lowest first 
    lScene.add( lMesh )
    //lScene.add ( tcontrols )
    lCamera.zoom = 0.25
    lCamera.updateProjectionMatrix()

    //lCamera.position.z = 5;
    animate()
}

function animate(){
    requestAnimationFrame( animate )
    lRenderer.render( lScene, lCamera );
    rRenderer.render( rScene, rCamera );

}

function loadSecondaryModal(){
    /**NOT OPTIMIZED */
    var dataSize = dsInfo['dims3']['x'] * dsInfo['dims3']['y'] * ( dsInfo['dims3']['z'] + 1 ) * 4 //1 == 0offset,4 == RGBA
    var dataSliceSize = dsInfo['dims3']['x'] * dsInfo['dims3']['y'] * 4
        
    var binaryData = new Uint8Array(dataSize)

    var text3d = new THREE.DataTexture3D(binaryData,dsInfo['dims3']['x'],dsInfo['dims3']['y'],dsInfo['dims3']['z'])
        text3d.format = THREE.RGBAFormat
        //text3d.type = THREE.UnsignedByteType
        text3d.center = new THREE.Vector2(.5,.5)
        text3d.minFilter = text3d.magFilter = THREE.LinearFilter
        
    var cellDataSize = dsInfo['dims3']['x'] * dsInfo['dims3']['y'] * ( dsInfo['dims3']['z'] + 1 ) * 1 //1 == 0offset, 1 == Greyscale
    let cellBinaryData = new Uint8Array(cellDataSize)
    let cellText3d = new THREE.DataTexture3D(cellBinaryData,dsInfo['dims3']['x'],dsInfo['dims3']['y'],dsInfo['dims3']['z'])
    //    //text3d.type = THREE.UnsignedByteType default
        cellText3d.format = THREE.RedFormat
        cellText3d.center = new THREE.Vector2(.5,.5)
        cellText3d.minFilter = text3d.magFilter = THREE.LinearFilter
    //    text3d.unpackAlignment = 1
    let modFloat = '1.' // 0: BL, 1: FL
    //if ( modSelect.value == 'Brightfield')
    //    modFloat = '0' 

    var shader = VolumeRenderShader1;
    var uniforms = THREE.UniformsUtils.clone( shader.uniforms );
    uniforms[ "u_data" ].value = text3d;
    uniforms[ "u_size" ].value = new THREE.Vector3( 
                                                    dsInfo['dims3']['x'], dsInfo['dims3']['y'],
                                                    dsInfo['dims3']['z'] * dsInfo['voxels']['z']
                                                    )
    uniforms[ "u_clip" ].value = new THREE.Vector3( 0, 0, 0 )
    uniforms[ "u_clipValues" ].value = new THREE.Vector3( 
                                                        0.,
                                                        0.,
                                                        0.
                                                        )
    uniforms[ "u_renderstyle" ].value = '3' // 0: MIP, 1: ISO , 2: Surface
    uniforms[ "u_modalType" ].value = 0.
    uniforms[ "u_renderthreshold" ].value = 0.15; // For ISO renderstyle
    uniforms[ "u_threshold" ].value = 0.3; 
    uniforms[ "u_background" ].value = new THREE.Vector4( 255, 255, 255, 255 ) // 0 0 255 for blue
    uniforms[ "u_cell" ].value = 0.
    uniforms[ "u_cellData" ] = cellText3d//no matter the clip render flourenscent cells
    rMaterial = new THREE.ShaderMaterial( {
        uniforms: uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        side: THREE.BackSide // The volume shader uses the backface as its "reference point"
    } )
    rMaterial.alphaTest = 0.5
    rMesh = new THREE.Mesh( rGeom, rMaterial )
    let zCounter = 0
    
    
    new JSZip.external.Promise(function (resolve, reject) {
        
        JSZipUtils.getBinaryContent(
            `./static/cryoData/${dsInfo['name']}/MR.zip`
            , function(err, data) {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    }).then(function (data) {
        
        JSZip.loadAsync(data).then(function (zip) {
            Object.keys(zip.files).forEach(function (filename) {
              zip.files[filename].async('base64').then(function (fileData) {
                let can = new Image()
                can.src = 'data:image/png;base64,'+fileData
                can.onload = function () {
                    
                    let c = document.createElement('canvas')
                    c.width = dsInfo['dims3']['x']
                    c.height = dsInfo['dims3']['y']
                    let ctx = c.getContext('2d')
                    ctx.drawImage(this, 0, 0, dsInfo['dims3']['x'], dsInfo['dims3']['y'])
                    //document.body.appendChild(c)
                    let index = Number(filename.split('.')[0])
                    text3d.needsUpdate = true
                    binaryData.set(ctx.getImageData(0,0, dsInfo['dims3']['x'], dsInfo['dims3']['y']).data,(index * dataSliceSize))
                    zCounter++
                    if (zCounter == dsInfo["dims3"]["z"] - 1){
                        rMesh.visible = true
                        zCounter = 0
                    }
                        
                }
              })
            })
        })
    }) 

    rMesh.visible = false
    rMesh.renderOrder = 1.0 //draws lowest first 
    rScene.add( rMesh )
    //lScene.add ( tcontrols )
    rCamera.zoom = 0.25
    rCamera.updateProjectionMatrix()

}

document.addEventListener("DOMContentLoaded", () => {
    fetch('/getDatasetInfo', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
    },
        body: JSON.stringify({'name': 'Mouse884'}),
    })
    .then(response => response.json())
    .then(data => {
        dsInfo = data[0]
        let mainDiv = document.getElementById('mainCard')
        rendererWidth = (mainDiv.offsetWidth - 40)  / 2 //padding == 40
        lRenderer.setSize( rendererWidth , 640 );
        rRenderer.setSize( rendererWidth , 640 ); 
        init()
    })
})

window.addEventListener('resize', () => {
    let mainDiv = document.getElementById('mainCard')
        rendererWidth = (mainDiv.offsetWidth - 40)  / 2 //padding == 40
    lCamera.aspect = ( rendererWidth / 640 ) 
    lCamera.updateProjectionMatrix()
    lRenderer.setSize( rendererWidth , 640 )

    rCamera.aspect = ( rendererWidth / 640 ) 
    rCamera.updateProjectionMatrix()
    rRenderer.setSize( rendererWidth , 640 )

    
})