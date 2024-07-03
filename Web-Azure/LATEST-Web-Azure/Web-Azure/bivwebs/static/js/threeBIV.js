import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r119/three.module.min.js'
import { BasisTextureLoader } from 'https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/loaders/BasisTextureLoader.js'
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/controls/OrbitControls.js'
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/webxr/VRButton.js'
import { TransformControls } from 'https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/controls/TransformControls.js'
/* DS change handler*/
document.getElementById("dsBtnEvent").addEventListener("click", () => {
    visBtn.disabled = false
    //console.log(window.dsInfo) idk if we have to go this far for safari
    //dswindow.dsInfo
    if (typeof mesh === 'object') {
        if (!window.isVrTabSelected) {
            mesh.visible = false
            scene.remove(...scene.children)
            boundingLine = null
            alreadyOn = false
            xclip.value = null
            yclip.value = null
        }
        
        //init2(false)
    }
})
let visBtn = document.getElementById("visBtn")
const canvas = document.querySelector('#c')
let opacity = document.getElementById("opacity")
let shaderSelect = document.getElementById("shaderSelect")
let edgesBox = document.getElementById("edgesCheckbox")
// let exportBtn3D = document.getElementById('exportBtn3D'),
//     exportXYZSelect = document.getElementById('exportXYZSelect'),
//     exportWidthSelect = document.getElementById('exportWidthSelect'),
//     exportHeightInput = document.getElementById('exportHeightInput');
// exportBtn.disabled = false, exportXYZSelect.disabled = false, exportHeightInput.disabled = false, exportWidthSelect.disabled = false;
let context = canvas.getContext('webgl2', { antialias: true })
const renderer = new THREE.WebGLRenderer({ canvas, context, 'powerPreference': 'high-performance' });
var scene = new THREE.Scene(), camera, material, controls, animationId, tcontrols
var geometry, xGeometry, yGeometry, zGeometry
var xMaterial = new THREE.ShaderMaterial({
    uniforms: {
        u_texture: { value: null },
        u_threshold: { value: null },
        u_mod: { value: null }
    },
    vertexShader: document.getElementById('vertex_shader').textContent,
    fragmentShader: document.getElementById('fragment_shader').textContent
}),
    yMaterial = new THREE.ShaderMaterial({
        uniforms: {
            u_texture: { value: null },
            u_threshold: { value: null },
            u_mod: { value: null }
        },
        vertexShader: document.getElementById('vertex_shader').textContent,
        fragmentShader: document.getElementById('fragment_shader').textContent
    }),
    zMaterial = new THREE.ShaderMaterial({
        uniforms: {
            u_texture: { value: null },
            u_threshold: { value: null },
            u_mod: { value: null }
        },
        vertexShader: document.getElementById('vertex_shader').textContent,
        fragmentShader: document.getElementById('fragment_shader').textContent
    }),
    cMaterial = new THREE.MeshBasicMaterial()

var mesh, xMesh, yMesh, zMesh, boundingLine, cMesh
var cellBinaryData
var cellText3d
var loader = new BasisTextureLoader()
loader.setTranscoderPath('./static/js/libs/basis/')
loader.detectSupport(renderer)
//@TODO NEEDS TESTED
//document.getElementById("threeCard").appendChild( VRButton.createButton( renderer ) );
//renderer.xr.enabled = true;
var alreadyOn = false


// exportWidthSelect.addEventListener('change', () => {
//     exportHeightInput.value = Math.round((dsInfo["imageDims"]["y"] / dsInfo["imageDims"]["x"]) * exportWidthSelect.options[exportWidthSelect.selectedIndex].text)
// })

// exportBtn3D.onclick = () => {
//     // takeScreenshot3D(exportWidthSelect.options[exportWidthSelect.selectedIndex].text, exportHeightInput.value, exportXYZSelect.options[exportXYZSelect.selectedIndex].text)
// }

function takeScreenshot3D(width, height, axis) {
    const screenHeight = window.innerHeight;

    // Create scene object
    const scene = new THREE.Scene();

    // Create camera object
    const camera = new THREE.OrthographicCamera(
        renderer.domElement.width / -2,
        renderer.domElement.width / 2,
        renderer.domElement.height / 2,
        renderer.domElement.height / -2,
        1,
        8000
    );

    // Create renderer object
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
    });

    // If width is 0, calculate a default value
    if (width == 0) {
        height = Math.round((dsInfo["imageDims"]["y"] / dsInfo["imageDims"]["x"]) * 1024);
        width = Math.round((dsInfo["imageDims"]["x"] / dsInfo["imageDims"]["y"]) * height);
    }

    // If axis is "3D"
    if (axis == "3D") {

        // Set the left, right, top and bottom properties of the camera
        const aspect = width / height;
        const cameraLeft = -(100 * aspect);
        const cameraRight = 100 * aspect;
        const cameraTop = 100;
        const cameraBottom = -100;
        camera.left = cameraLeft;
        camera.right = cameraRight;
        camera.top = cameraTop;
        camera.bottom = cameraBottom;

        // Update the camera's projection matrix and renderer size
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);

        // Render the scene and save the screenshot
        renderer.render(scene, camera, null, false);
        const dataURL = renderer.domElement.toDataURL('image/png');
        saveDataURI(defaultFileName('.png'), dataURL);

        // Update the camera's left, right, top and bottom properties and the renderer's size
        const divWidth = $(oDivs['yz']).width() - 30;
        const divHeight = screenHeight / 3;
        const divAspect = divWidth / divHeight;
        const cameraLeft2 = -(100 * divAspect);
        const cameraRight2 = 100 * divAspect;
        const cameraTop2 = 100;
        const cameraBottom2 = -100;
        camera.left = cameraLeft2;
        camera.right = cameraRight2;
        camera.top = cameraTop2;
        camera.bottom = cameraBottom2;
        camera.updateProjectionMatrix();
        renderer.setSize(divWidth, divHeight);
    }
}

function saveDataURI(name, dataURI) {
    const blob = dataURIToBlob(dataURI);

    // force download
    const link = document.createElement('a');
    link.download = name;
    link.href = window.URL.createObjectURL(blob);
    link.onclick = () => {
        window.setTimeout(() => {
            window.URL.revokeObjectURL(blob);
            link.removeAttribute('href');
        }, 500);

    };
    link.click();
}

window.isVrTabSelected = false; // Initialized to unselected state
window.isOrthoTabSelected = true;

function clearScene() {
    while (scene.children.length > 0) {
        let object = scene.children[0];
        if (object.dispose) {
            object.dispose(); // If the object has a dispose method, call it
        }
        scene.remove(object); // Remove objects from the scene
    }
}

document.getElementById('vrTab').addEventListener('click', () => {
    window.isVrTabSelected = true;
    window.isOrthoTabSelected = false;
    clearScene(); // Clear scene
    init2(true); // Initialize VR view
});

document.getElementById('orthoTab').addEventListener('click', () => {
    window.isVrTabSelected = false;
    window.isOrthoTabSelected = true;
    window.cancelAnimationFrame(animationId); // Cancel the current animation frame
    clearScene(); // Clear scene
});


/*
visBtn.addEventListener('click', () => {
    if( visBtn.innerHTML == '3D on' ){
        visBtn.disabled = true
        visBtn.innerHTML = '3D off'
        init2(true)
    } else {
        boundingLine = null
        renderer.clear()
        window.cancelAnimationFrame(animationId)
        visBtn.innerHTML = '3D on'
        alreadyOn = false
    }
}) */


function init2(fullLoad) {
    document.getElementById(`vrOverlayDiv`).classList.remove('d-none')
    document.getElementById(`vrOverlayDiv`).classList.add('d-flex')

    // if (!zclip.value)
    zclip.value = Math.round(dsInfo["imageDims"]["z"] / 2)
    // if (!yclip.value)
    yclip.value = Math.round(parseInt(dsInfo["imageDims"]["y"]) / 2 / 4) * 4
    // if (!xclip.value)
    xclip.value = Math.round(parseInt(dsInfo["imageDims"]["x"]) / 2 / 4) * 4
    if (fullLoad) {
        //These should be set to what the 2D scene values are
        //zclip.value = Math.round(dsInfo["imageDims"]["z"] / 2) 
        zclip.min = 0
        zclip.max = dsInfo["imageDims"]["z"] - 1 //0 index
        zclip.disabled = false


        //yclip.value = Math.round(parseInt(dsInfo["imageDims"]["y"]) / 2 / 4 ) * 4 
        yclip.min = 0
        yclip.max = dsInfo["imageDims"]["y"] - 1 //0 index
        yclip.disabled = false

        //xclip.value = Math.round(parseInt(dsInfo["imageDims"]["x"]) / 2 / 4 ) * 4 
        xclip.min = 0
        xclip.max = dsInfo["imageDims"]["x"] - 1 //0 index
        xclip.disabled = false
        //might do this cleaner, like simulate a click
        edgesBox.checked = false

        renderer.outputEncoding = THREE.sRGBEncoding
        camera = new THREE.OrthographicCamera(
            renderer.domElement.width / -2,
            renderer.domElement.width / 2,
            renderer.domElement.height / 2,
            renderer.domElement.height / - 2, 1, 8000
        )

        controls = new OrbitControls(camera, renderer.domElement)
        tcontrols = new TransformControls(camera, renderer.domElement)
        controls.addEventListener('change', () => {

        });

        controls.panSpeed = 0.5
        controls.rotateSpeed = 0.5
        controls.update();

        // scene = new THREE.Scene()

        geometry = new THREE.BoxBufferGeometry(dsInfo['dims3']['x'], dsInfo['dims3']['y'], dsInfo['dims3']['z'] + 200)

        camera.position.set(dsInfo['dims3']['x'], dsInfo['dims3']['y'], dsInfo['dims3']['x'])
        controls.target.set(
            dsInfo['dims3']['x'] / 2,
            dsInfo['dims3']['y'] / 2,
            dsInfo['dims3']['z'] * dsInfo['voxels']['z'] / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x']) / 2
        )
        controls.update()

        geometry.translate(
            dsInfo['dims3']['x'] / 2 - 0.5,
            dsInfo['dims3']['y'] / 2 - 0.5,
            dsInfo['dims3']['z'] * dsInfo['voxels']['z'] / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x']) / 2 - 0.5
        ) //to center the mesh in the geometry

    }
    // console.log('dims3_x' + dsInfo['dims3']['x'] + 'dims3_y' + dsInfo['dims3']['y'] + 'dims3_z' + dsInfo['dims3']['z'])
    var dataSize = dsInfo['dims3']['x'] * dsInfo['dims3']['y'] * (dsInfo['dims3']['z'] + 1) * 4 //1 == 0offset,4 == RGBA
    var dataSliceSize = dsInfo['dims3']['x'] * dsInfo['dims3']['y'] * 4

    var binaryData = new Uint8Array(dataSize)

    var text3d = new THREE.DataTexture3D(binaryData, dsInfo['dims3']['x'], dsInfo['dims3']['y'], dsInfo['dims3']['z'])
    text3d.format = THREE.RGBAFormat
    text3d.type = THREE.UnsignedByteType
    text3d.center = new THREE.Vector2(.5, .5)
    text3d.minFilter = text3d.magFilter = THREE.LinearFilter
    text3d.unpackAlignment = 1

    var cellDataSize = dsInfo['dims3']['x'] * dsInfo['dims3']['y'] * (dsInfo['dims3']['z'] + 1) * 1 //1 == 0offset, 1 == Greyscale
    cellBinaryData = new Uint8Array(cellDataSize)
    cellText3d = new THREE.DataTexture3D(cellBinaryData, dsInfo['dims3']['x'], dsInfo['dims3']['y'], dsInfo['dims3']['z'])
    //    //text3d.type = THREE.UnsignedByteType default
    cellText3d.format = THREE.LuminanceFormat
    cellText3d.center = new THREE.Vector2(.5, .5)
    cellText3d.minFilter = text3d.magFilter = THREE.LinearFilter


    let modFloat = '1.' // 0: BL, 1: FL
    if (modSelect.value == 'Brightfield')
        modFloat = '0'

    var shader = VolumeRenderShader1;
    var uniforms = THREE.UniformsUtils.clone(shader.uniforms);
    uniforms["u_data"].value = text3d;
    uniforms["u_size"].value = new THREE.Vector3(
        dsInfo['dims3']['x'], dsInfo['dims3']['y'],
        dsInfo['dims3']['z'] * dsInfo['voxels']['z'] / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x'])
    )
    uniforms["u_clip"].value = new THREE.Vector3(0, 0, 0)
    let scale = dsInfo['imageDims']['x'] / dsInfo['dims3']['x']
    uniforms["u_clipValues"].value = new THREE.Vector3(
        xclip.value / scale,
        yclip.value / scale,
        zclip.value * dsInfo['voxels']['z'] / scale
    )
    uniforms["u_renderstyle"].value = '2' // 0: MIP, 1: ISO , 2: Surface
    uniforms["u_modalType"].value = modFloat
    uniforms["u_renderthreshold"].value = 0.15; // For ISO renderstyle
    uniforms["u_threshold"].value = threshold.value / 10; // For ISO renderstyle
    uniforms["u_background"].value = new THREE.Vector4(255, 255, 255, 255)
    uniforms["u_cell"].value = parseFloat(+cellModalBox.checked)
    uniforms["u_cellData"] = cellText3d;//no matter the clip render flourenscent cells
    uniforms["u_cmdata"].value = new THREE.TextureLoader().load('./static/img/cm_viridis.png')
    material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        side: THREE.BackSide // The volume shader uses the backface as its "reference point"
    })

    material.alphaTest = 0.5
    mesh = new THREE.Mesh(geometry, material)
    let zCounter = 0
    let progDiv = document.getElementById("progressDiv")
    let progBar = document.getElementById("3dProgress")
    //progDiv.classList.remove("d-none")
    //progBar.setAttribute('aria-valuemax', dsInfo["dims3"]["z"])
    // console.log("modSelect.value", modSelect.value, "exposureSelect.value", exposureSelect.value)
    // URL = "https://bivlargefiles.blob.core.windows.net/zipfiles/WM_Brightfield-1-430.zip"

    new JSZip.external.Promise(function (resolve, reject) {
        JSZipUtils.getBinaryContent(
            `https://bivlargefiles.blob.core.windows.net/zipfiles/${dsInfo['name']}-${modSelect.value}-${exposureSelect.value}-${dsInfo.types[modSelect.value][exposureSelect.value][wavelengthSelect.value]}.zip`
            , function (err, data) {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
    }).then(function (data) {
        JSZip.loadAsync(data).then(function (zip) {
            Object.keys(zip.files).forEach(function (filename) {
                if (/\/xy\//.test(filename) && filename.endsWith('.png')) {
                    zip.files[filename].async('base64').then(function (fileData) {
                        let can = new Image()
                        can.src = 'data:image/png;base64,' + fileData
                        can.onload = function () {
                            let fn = filename.split('/').pop()
                            let c = document.createElement('canvas')
                            c.width = dsInfo['dims3']['x']
                            c.height = dsInfo['dims3']['y'] * 4
                            let ctx = c.getContext('2d')
                            ctx.drawImage(this, 0, 0, dsInfo['dims3']['x'], dsInfo['dims3']['y'])
                            let index = Number(fn.split('.')[0])
                            text3d.needsUpdate = true
                            binaryData.set(ctx.getImageData(0, 0, dsInfo['dims3']['x'], dsInfo['dims3']['y']).data, (index * dataSliceSize))
                            // console.log(fn, index, dataSliceSize)
                            zCounter++
                            //progBar.setAttribute('aria-valuenow', zCounter);
                            //progBar.style.width = `${zCounter}%`
                            if (zCounter == dsInfo["dims3"]["z"] - 1) {
                                document.getElementById(`vrOverlayDiv`).classList.remove('d-flex')
                                document.getElementById(`vrOverlayDiv`).classList.add('d-none')
                                //progDiv.classList.add("d-none")
                                mesh.visible = true
                                zCounter = 0
                                //progBar.setAttribute('aria-valuenow', zCounter);
                                //progBar.style.width = `${zCounter}%`
                                document.getElementById("visBtn").disabled = false
                                //necessary for when modaulity hot reloads
                                // zPlaneIn3d()
                                // yPlaneIn3d()
                                // xPlaneIn3d()
                            }
                        }
                    })
                }
            })
        })

    })

    // loadCellData()
    mesh.visible = false
    mesh.renderOrder = 1.0 //draws lowest first 
    scene.add(mesh)
    scene.add(tcontrols)
    camera.zoom = 0.25;
    camera.updateProjectionMatrix();
    clipXCheckbox.disabled = false
    clipYCheckbox.disabled = false
    clipZCheckbox.disabled = false
    if (!alreadyOn)
        animate()

    xGeometry = new THREE.PlaneBufferGeometry(
        dsInfo['dims2']['y'] / scale,
        dsInfo['dims2']['z'] * dsInfo['voxels']['z'] / scale
    )

    xMesh = new THREE.Mesh(xGeometry, xMaterial)
    xMesh.translateY(dsInfo['dims2']['y'] / 2 / scale)
    xMesh.translateX(xclip.value / scale)
    xMesh.translateZ(dsInfo['dims2']['z'] * dsInfo['voxels']['z'] / 2 / scale - 0.5)
    xMesh.rotateX(Math.PI / 2)
    xMesh.rotateY(Math.PI / 2)
    xMesh.visibility = false
    xMaterial.uniforms.u_mod.value = modFloat
    xMaterial.side = THREE.BackSide
    xMaterial.transparent = true
    xMaterial.needsUpdate = true
    scene.add(xMesh)

    yGeometry = new THREE.PlaneBufferGeometry(
        dsInfo['dims2']['x'] / scale,
        dsInfo['dims2']['z'] * dsInfo['voxels']['z'] / scale
    )

    yMesh = new THREE.Mesh(yGeometry, yMaterial)
    yMesh.translateX(dsInfo['dims2']['x'] / 2 / scale)
    yMesh.translateY(yclip.value / scale)
    yMesh.translateZ(dsInfo['dims2']['z'] * dsInfo['voxels']['z'] / 2 / scale - 0.5)
    yMesh.rotateX(Math.PI / 2)
    yMesh.visibility = false
    yMaterial.uniforms.u_mod.value = modFloat
    yMaterial.transparent = true
    yMaterial.needsUpdate = true
    scene.add(yMesh)

    zGeometry = new THREE.PlaneBufferGeometry(
        dsInfo['dims2']['x'] / scale,
        dsInfo['dims2']['y'] / scale
    )

    zMesh = new THREE.Mesh(zGeometry, zMaterial)

    zMesh.translateX(dsInfo['dims2']['x'] / 2 / scale)
    zMesh.translateY(dsInfo['dims2']['y'] / 2 / scale)
    zMesh.translateZ(zclip.value * dsInfo['voxels']['z'] / scale)
    zMesh.visibility = false
    zMaterial.side = THREE.BackSide
    zMaterial.uniforms.u_mod.value = modFloat
    zMaterial.transparent = true
    zMaterial.needsUpdate = true
    scene.add(zMesh)
    xPlaneIn3d()
    yPlaneIn3d()
    zPlaneIn3d()

    //Definitely want to transition the choosen color to a global var
    let rgba = pickr2.getColor().toRGBA()
    material.uniforms.u_background.value.set(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3])


    pickr2.on('save', instance => {
        let rgba = pickr2.getColor().toRGBA()
        material.uniforms.u_background.value.set(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3])
    })

    pickr2.on('hide', instance => {
        let rgba = pickr2.getColor().toRGBA()
        material.uniforms.u_background.value.set(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3])
    })

    pickr2.on('change', instance => {
        let rgba = pickr2.getColor().toRGBA()
        material.uniforms.u_background.value.set(rgba[0] / 255, rgba[1] / 255, rgba[2] / 255, rgba[3])
    })
}
//only show this input if dataset has cell data available
//use this 
let cellModalBox = document.getElementById("cellModalBox")
//function loadCellData() {
cellModalBox.addEventListener('click', () => {
    material.uniforms["u_cell"].value = parseFloat(+cellModalBox.checked)
})

function loadCellData() {
    //if(!document.getElementById("cellModalBox").checked){
    //    cellBinaryData = null
    //    cellText3d.needsUpdate = true
    //   return
    //}
    //material.uniforms[ "u_cell" ].value = new THREE.Vector3( +cellModalBox.checked, +cellModalBox.checked, +cellModalBox.checked  )
    var dataSliceSize = dsInfo['dims3']['x'] * dsInfo['dims3']['y'] * 1
    //let dataArray = new Uint8Array(dataSliceSize)
    //delete this code block
    //for (let i = 0; i < dataSliceSize; i++) {
    //write this correctly with 0-1 to range in ortho
    //let n = Math.random()
    //    if (n < .9995 )  n = 0
    //    data[i] =  n * 255// pass anything from 0 to 255
    //}
    new JSZip.external.Promise(function (resolve, reject) {

        JSZipUtils.getBinaryContent(
            `./static/cryoData/${dsInfo['name']}/tmp_file.zip`
            , function (err, data) {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
    }).then(function (data) {

        JSZip.loadAsync(data).then(function (zip) {
            zip.file("tmp_file.txt").async("text")
                .then(function success(txt) {
                    //let dataArray = new Uint8Array(dataSliceSize)
                    let sectionSize = dsInfo['dims3']['x'] * dsInfo['dims3']['y'] * 1
                    for (let z = 0; z < dsInfo['dims3']['z']; z++) {
                        let section = txt.substr(z * sectionSize, sectionSize)
                        let dataArray = new Uint8Array(dataSliceSize)
                        for (var i = 0; i < section.length; i++) {
                            dataArray[i] = parseInt(section.charAt(i)) * 250
                        }
                        cellBinaryData.set(dataArray, (z * dataSliceSize))
                    }
                    cellText3d.needsUpdate = true
                    material.uniforms["u_cellData"].value = cellText3d //critical
                }, function error(e) {
                    console.error(e);
                });
        })
    })


}


let timeout = null
clipXCheckbox.addEventListener('click', xPlaneIn3d)
xclip.addEventListener("keyup", xPlaneIn3d)

function xPlaneIn3d() {
    material.uniforms["u_clip"].value = new THREE.Vector3(+clipXCheckbox.checked, +clipYCheckbox.checked, +clipZCheckbox.checked)
    if (!clipXCheckbox.checked) {
        xMesh.visible = false
        return
    }

    clearTimeout(timeout)
    // Make a new timeout set to go off in 1000ms (1 second)
    timeout = setTimeout(function () {
        xclip.value = Math.round(xclip.value / 4) * 4
        xMesh.visible = true

        material.uniforms["u_clipValues"].value = new THREE.Vector3(
            xclip.value / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x']),
            yclip.value / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x']),
            zclip.value * dsInfo['voxels']['z'] / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x'])
        )

        loader.load(`./static/cryoData/${dsInfo['name']}/basis/${modSelect.value}/${exposureSelect.value}/${dsInfo.types[modSelect.value][exposureSelect.value][wavelengthSelect.value]}/yz/${xclip.value}.basis`, function (texture) {
            texture.encoding = THREE.sRGBEncoding

            let scale = (dsInfo['imageDims']['x'] / dsInfo['dims3']['x'])
            xMesh.rotateY(- Math.PI / 2)
            xMesh.rotateX(- Math.PI / 2)
            xMesh.position.x = 0
            xMesh.translateX(xclip.value / scale)
            xMesh.rotateX(Math.PI / 2)
            xMesh.rotateY(Math.PI / 2)

            xMaterial.uniforms.u_texture.value = texture
            xMaterial.uniforms.u_threshold.value = threshold.value / 10
            xMaterial.needsUpdate = true

        }, undefined, function (error) {

            console.error(error)

        })

    }, 1000)

}

clipYCheckbox.addEventListener('click', yPlaneIn3d)
yclip.addEventListener("keyup", yPlaneIn3d)

function yPlaneIn3d() {
    material.uniforms["u_clip"].value = new THREE.Vector3(+clipXCheckbox.checked, +clipYCheckbox.checked, +clipZCheckbox.checked)
    if (!clipYCheckbox.checked) {
        yMesh.visible = false
        return
    }

    clearTimeout(timeout)
    // Make a new timeout set to go off in 1000ms (1 second)
    timeout = setTimeout(function () {
        yclip.value = Math.round(yclip.value / 4) * 4
        yMesh.visible = true

        material.uniforms["u_clipValues"].value = new THREE.Vector3(
            xclip.value / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x']),
            yclip.value / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x']),
            zclip.value * dsInfo['voxels']['z'] / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x'])
        )
        loader.load(`./static/cryoData/${dsInfo['name']}/basis/${modSelect.value}/${exposureSelect.value}/${dsInfo.types[modSelect.value][exposureSelect.value][wavelengthSelect.value]}/xz/${yclip.value}.basis`, function (texture) {
            texture.encoding = THREE.sRGBEncoding
            let scale = (dsInfo['imageDims']['x'] / dsInfo['dims3']['x'])

            yMesh.rotateX(- Math.PI / 2)
            yMesh.position.y = 0
            yMesh.translateY(yclip.value / scale)
            yMesh.rotateX(Math.PI / 2)
            yMaterial.uniforms.u_texture.value = texture
            yMaterial.uniforms.u_threshold.value = threshold.value / 10
            yMaterial.needsUpdate = true

        }, undefined, function (error) {

            console.error(error)

        })
    }, 1000)

}


clipZCheckbox.addEventListener('click', zPlaneIn3d)
zclip.addEventListener("keyup", zPlaneIn3d)

function zPlaneIn3d() {
    if (!material)
        return
    material.uniforms["u_clip"].value = new THREE.Vector3(+clipXCheckbox.checked, +clipYCheckbox.checked, +clipZCheckbox.checked)
    if (typeof zMesh !== 'object')
        return
    if (!clipZCheckbox.checked) {
        zMesh.visible = false
        return
    }

    clearTimeout(timeout)
    // Make a new timeout set to go off in 1000ms (1 second)
    timeout = setTimeout(function () {
        zMesh.visible = true

        material.uniforms["u_clipValues"].value = new THREE.Vector3(
            xclip.value / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x']),
            yclip.value / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x']),
            zclip.value * dsInfo['voxels']['z'] / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x'])
        )
        loader.load(`./static/cryoData/${dsInfo['name']}/basis/${modSelect.value}/${exposureSelect.value}/${dsInfo.types[modSelect.value][exposureSelect.value][wavelengthSelect.value]}/xy/${zclip.value}.basis`, function (texture) {
            texture.encoding = THREE.sRGBEncoding
            let scale = (dsInfo['imageDims']['x'] / dsInfo['dims3']['x'])
            zMesh.position.z = 0
            zMesh.translateZ(zclip.value * dsInfo['voxels']['z'] / scale)
            zMaterial.uniforms.u_texture.value = texture
            zMaterial.uniforms.u_threshold.value = threshold.value / 10
            zMaterial.needsUpdate = true

        }, undefined, function (error) {

            console.error(error)

        })
    }, 1000)
}

edgesBox.addEventListener('click', () => {
    if (edgesBox.checked && boundingLine) {
        boundingLine.visible = true
    } else if (!edgesBox.checked) {
        boundingLine.visible = false
    } else {
        let geometry = new THREE.BoxBufferGeometry(
            dsInfo['dims3']['x'],
            dsInfo['dims3']['y'],
            dsInfo['dims3']['z'] * dsInfo['voxels']['z'] / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x'])
        );
        geometry.translate(
            dsInfo['dims3']['x'] / 2 - 0.5,
            dsInfo['dims3']['y'] / 2 - 0.5,
            dsInfo['dims3']['z'] * dsInfo['voxels']['z'] / (dsInfo['imageDims']['x'] / dsInfo['dims3']['x']) / 2 - 0.5
        )
        let edges = new THREE.EdgesGeometry(geometry);
        boundingLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffbf00, linewidth: .75 }));
        scene.add(boundingLine);
    }


})

threshold.addEventListener("change", () => {
    if (material)
        material.uniforms["u_threshold"].value = threshold.value / 10
    if (xMaterial)
        xMaterial.uniforms.u_threshold.value = threshold.value / 10
    if (yMaterial)
        yMaterial.uniforms.u_threshold.value = threshold.value / 10
    if (zMaterial)
        zMaterial.uniforms.u_threshold.value = threshold.value / 10
})

opacity.addEventListener("change", () => {
    if (material)
        material.uniforms.u_opacity.value = opacity.value / 10

})

shaderSelect.addEventListener("change", () => {
    if (material)
        material.uniforms.u_renderstyle.value = shaderSelect.value

})



function animate() {
    //don't render if user tabbed out
    //if (document.hidden) @firefox bug, can no longer control the scene when tabbing back in 
    //    return


    animationId = requestAnimationFrame(animate)
    renderer.render(scene, camera);
}

/*
modSelect.addEventListener('change', () => {
    
    if ( alreadyOn ){
        mesh.visible = false
        scene.remove(...scene.children)
        boundingLine = null
        init2(false)
    }

}) */

document.getElementById("3dFullIcon").addEventListener('click', () => {
    if (!document.fullscreenElement) {
        canvas.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    } else {
        document.exitFullscreen();
    }
})

/* significant performance hit
var resizeTimer
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {

        if(!camera)
            return
        camera.aspect = ( canvas.offsetWidth / 600 ) //@TODO HARDCODE
        camera.updateProjectionMatrix()
        renderer.setSize( canvas.offsetWidth , 600 )
                
    }, 250);

}) */

