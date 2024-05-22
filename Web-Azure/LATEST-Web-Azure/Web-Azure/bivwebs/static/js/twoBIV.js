//@TODO MAKE LOCAL
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r119/three.module.min.js'
import { BasisTextureLoader } from 'https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/loaders/BasisTextureLoader.js'
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.119.1/examples/jsm/controls/OrbitControls.js'
import { DragControls } from './DragControls.js'

//unorganized variables
let dsChanged = true, modChanged, annSlices, dsName, files, orthosActive = true, currentPlane
var changeEvent = new Event('change')
var keyEvent = new Event('keyup')
let xyInputTimeout
var previousSlice
let session
var SAS = 'sp=r&st=2023-08-14T15:15:15Z&se=2036-06-18T15:15:00Z&spr=https&sv=2022-11-02&sig=pisDbcAw2k0FGGNHg5i4FIqJklWf9%2BAW03VkeidVsWk%3D&sr=s'
let Selectslice, Selectplane
let originODivWith

let measureData = {
    xy: { clicks: [], lines: [] },
    xz: { clicks: [], lines: [] },
    yz: { clicks: [], lines: [] }
};


dsSelect.addEventListener("change", () => {
    if (!dsSelect.value) return;

    // 检查按钮是否已启用
    // const loadButton = document.getElementById('loadDatasetBtn');
    // const isLoadButtonEnabled = !loadButton.disabled;


    fetch('/getDatasetInfo', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 'name': dsSelect.value }),
    })
        .then(response => response.json())
        .then(data => {

            // 继续处理数据
            session = data['session'];
            dsName = data['dataset_info'][0]['name'];
            dsInfo = data['dataset_info'][0];
            annSlices = data['dataset_info'][0]['ann'];
            files = data['dataset_info'][0]['file'];
            dsChanged = true;
            modSelect.disabled = false;

            let modCounter = 0, expCounter = 0, waveCounter = 0;
            modSelect.innerHTML = ``;
            exposureSelect.innerHTML = ``;
            wavelengthSelect.innerHTML = ``;
            if (lineTextGroup) {
                lineTextGroup.remove(...lineTextGroup.children);
            }

            // 填充选择框
            for (const mod in dsInfo.types) {
                let opt = document.createElement('option');
                opt.appendChild(document.createTextNode(mod));
                opt.value = mod;
                modSelect.appendChild(opt);
                modCounter++;
                for (const exp in dsInfo.types[mod]) {
                    expCounter++;
                    for (const wave in dsInfo.types[mod][exp]) {
                        waveCounter++;
                    }
                }
            }

            // 默认选择第一个模式，并触发事件
            modSelect.selectedIndex = 0;
            var event = new Event('change');
            modSelect.dispatchEvent(event);
        })
        .catch((error) => {
            console.error('Error:', error);
        });
    // // 如果按钮启用，延迟 1 秒启用
    // if (isLoadButtonEnabled) {
    //     loadButton.disabled = true;
    //     setTimeout(() => {
    //         loadButton.disabled = false;
    //     }, 1000);
    // }
    // else {
    //     setTimeout(() => {
    //         loadButton.disabled = false;
    //     }, 1000);
    // }
});



modSelect.addEventListener("change", changeMod)
function changeMod() {
    exposureSelect.innerHTML = ``
    wavelengthSelect.innerHTML = ``
    modChanged = true
    if (!modSelect.value)
        return
    let expCounter = 0, waveCounter = 0
    exposureSelect.disabled = false
    for (const exp in dsInfo.types[modSelect.value]) {
        expCounter++
        let opt = document.createElement('option')
        opt.appendChild(document.createTextNode(exp))
        opt.value = exp
        exposureSelect.appendChild(opt)

        for (const wave in dsInfo.types[modSelect.value][exp]) {
            waveCounter++
        }
    }
    // if (expCounter < 2 && waveCounter < 2) {
    exposureSelect.selectedIndex = "0"
    changeExposure()

    // }
}

exposureSelect.addEventListener("change", changeExposure)
function changeExposure() {
    if (!exposureSelect.value)
        return

    wavelengthSelect.innerHTML = ``
    let waveCounter = 0
    wavelengthSelect.disabled = false
    for (const wave in dsInfo.types[modSelect.value][exposureSelect.value]) {
        waveCounter++
        let opt = document.createElement('option')
        opt.appendChild(document.createTextNode(`${dsInfo.types[modSelect.value][exposureSelect.value][wave]}`))
        opt.value = wave
        wavelengthSelect.appendChild(opt)
    }

    if (waveCounter < 2) {
        wavelengthSelect.selectedIndex = "0"
        changeWavelength()
    }
}

wavelengthSelect.addEventListener("change", changeWavelength)
function changeWavelength() {
    if (!wavelengthSelect.value)
        return
}

function handleSelectChange() {
    if (!document.getElementById('dsSelect').value || !document.getElementById('modSelect').value || !document.getElementById('exposureSelect').value || !document.getElementById('wavelengthSelect').value) {
        return
    };

    document.getElementById('xy-card-body').classList.remove('d-none')
    document.getElementById('UpMainDiv').classList.remove('d-none');
    document.getElementById('DownMainDiv').classList.remove('d-none');
    document.getElementById('DownToolDiv').classList.remove('d-none');
    document.getElementById('orthoTab').classList.remove('disabled');
    document.getElementById('orthoTab').classList.add('active');
    document.getElementById('vrTab').classList.remove('disabled');
    document.getElementById('tab1').classList.remove('d-none');
    document.getElementById('tab2').classList.remove('d-none');
    document.getElementById('tab3').classList.remove('d-none');
    document.getElementById('tab4').classList.remove('d-none');
    document.getElementById('tab5').classList.remove('d-none');
    document.getElementById('myTabNav').classList.remove('d-none');
    document.getElementById('info').classList.remove('d-none');
    document.getElementById('tab7').classList.remove('d-none');

    loadDynamic2D(dsChanged);
    if (window.isVrTabSelected) {
        const clickEvent = new Event('click');
        const vrTabElement = document.getElementById('vrTab');
        vrTabElement.dispatchEvent(clickEvent);
    }
    addAnnotationEvents();
    populateInfoTable();

    if (dsChanged && !orthosActive) {
        document.getElementById('orthoTab').click();
    }

    if (dsChanged || modChanged) {
        document.getElementById("dsBtnEvent").click();
    }
    dsChanged = false;
}

// 给所有相关的选择框添加事件监听
document.getElementById('dsSelect').addEventListener('change', handleSelectChange);
document.getElementById('modSelect').addEventListener('change', handleSelectChange);
document.getElementById('exposureSelect').addEventListener('change', handleSelectChange);
document.getElementById('wavelengthSelect').addEventListener('change', handleSelectChange);

//HTML ELEMENTS
let canvasXY, canvasXZ, canvasYZ, exportWidthSelect, exportHeightInput, fullScreenInput
let forwardBtn = document.getElementById("forwardBtn"),
    backBtn = document.getElementById("backBtn"),
    backStepBtn = document.getElementById("stepBackBtn"),
    forwardStepBtn = document.getElementById("stepForwardBtn"),
    createAnnBtn = document.getElementById("createAnnBtn"),
    toggleAnnBtn = document.getElementById("toggleAnnBtn"),
    exportBtn = document.getElementById('exportBtn'),
    exportXYZSelect = document.getElementById('exportXYZSelect'),
    exportSizeSelect = document.getElementById('exportSizeSelect'),
    FullScreenSelect = document.getElementById('FullScreenSelect'),
    FullScreenBtn = document.getElementById('FullScreenBtn'),
    saveViewBtn = document.getElementById('saveViewBtn'),
    // loadViewBtn = document.getElementById('loadViewBtn'),
    // delViewBtn = document.getElementById('delViewBtn'),
    full3dBtn = document.getElementById("3dFullIconBtn"),
    measureBtn = document.getElementById("measureBtn"),
    maskInput = document.getElementById("maskInput"),
    startMaskBtn = document.getElementById("startMaskBtn"),
    eraseMaskBtn = document.getElementById("eraseMaskBtn"),
    finishedMaskBtn = document.getElementById("finishedMaskBtn"),
    maskLoadInput = document.getElementById("maskLoadInput"),
    loadMaskBtn = document.getElementById("loadMaskBtn"),
    copySliceBox = document.getElementById("copySliceBox"),
    measureClearBtn = document.getElementById("measureClearBtn"),
    // viewSelect = document.getElementById("viewsSelect"),
    annTableBody = document.getElementById("annTbody"),
    xyInput = document.getElementById("sliceInput"),
    slider = document.getElementById("sliceRange"),
    pixelBox = document.getElementById("pixelBox"),
    xyDiv = document.getElementById("xyDiv"),
    xzDiv = document.getElementById("xzDiv"),
    yzDiv = document.getElementById("yzDiv"),
    annModalSave = document.getElementById("annModalSave"),
    annModalDelete = document.getElementById("annModalDelete"),
    fileManageBtn = document.getElementById("fileManageBtn"),
    fileMTableBody = document.getElementById("fileMTbody"),
    zoomBox = document.getElementById('zoomCheckbox'),
    annFontNumber = document.getElementById('annFontNumber'),
    fileChooseBtn = document.getElementById('FileChooseBtn'),
    fileInput = document.getElementById("file-input"),
    filename = document.getElementById("file-name"),
    UploadFileBtn = document.getElementById("UploadFileBtn")

//THREE JS ELEMENTS
let cameraXY, sceneXY, controlsXY, rendererXY, mesh, geometry, material2, loader, maskGeometry, maskMaterial, dControls
let lineTextGroup = new THREE.Group(), XYannTextGroup = new THREE.Group(), XZannTextGroup = new THREE.Group(), YZannTextGroup = new THREE.Group(), brushGroup = new THREE.Group(),
    scaleVector = new THREE.Vector3()
var xzMesh, xzMat, yzMesh, yzMat, xzGeom, yzGeom, oMaterials, oGeoms, oMeshes, oClip, oDivs, oScenes, oCameras, oRenderers, oControls, oAnimate
let xzScene, yzScene, xzControls, yzControls, xzRenderer, yzRenderer, xzCamera, yzCamera, xzAnimateId, yzAnimateId

let oLines, xzLineGroup = new THREE.Group(), yzLineGroup = new THREE.Group({ visible: false }),
    xzVertLine, xzHorzLine, yzVertLine, yzHorzLine, xzVertLineGeom, xzHorzLineGeom, yzVertLineGeom, yzHorzLineGeom

let mouse = new THREE.Vector2(), rayCaster = new THREE.Raycaster()
const xyShader = new THREE.ShaderMaterial({
    uniforms: {
        u_texture: { value: null },
        u_threshold: { value: null },
        u_mod: { value: null }
    },
    vertexShader: document.getElementById('vertex_shader').textContent,
    fragmentShader: document.getElementById('fragment_shader').textContent
})
const xzShader = new THREE.ShaderMaterial({
    uniforms: {
        u_texture: { value: null },
        u_threshold: { value: null },
        u_mod: { value: null }
    },
    vertexShader: document.getElementById('vertex_shader').textContent,
    fragmentShader: document.getElementById('fragment_shader').textContent
})
const yzShader = new THREE.ShaderMaterial({
    uniforms: {
        u_texture: { value: null },
        u_threshold: { value: null },
        u_mod: { value: null }
    },
    vertexShader: document.getElementById('vertex_shader').textContent,
    fragmentShader: document.getElementById('fragment_shader').textContent
})
loader = new BasisTextureLoader()
loader.setTranscoderPath('./static/js/libs/basis/')

let supportPass = false, draggedAnn = false, previousHoverObj

function loadDynamic2D(fullLoad) {
    if (!canvasXY) {
        // xyDiv.style.height = 'auto'
        rendererXY = new THREE.WebGLRenderer({ preserveDrawingBuffer: true })
        rendererXY.setSize(xyDiv.offsetWidth, Math.floor(window.innerHeight * 0.25))
        rendererXY.outputEncoding = THREE.sRGBEncoding
        xyDiv.appendChild(rendererXY.domElement);
        canvasXY = rendererXY.domElement
        // canvasYZ = rendererXY.domElement
        rendererXY.domElement.id = 'xyBasis'
    }
    //if ( param from wv)
    if (fullLoad) {
        let slice = Math.round(dsInfo["imageDims"]["z"] / 2)
        slider.min = 0
        slider.max = parseInt(dsInfo["imageDims"]["z"]) - 1 //0 index
        zclip.max = dsInfo["imageDims"]["z"] - 1 //0 index
        slider.value = slice
        zclip.value = slice
        xyInput.value = slice
        previousSlice = slice
        clipCoords.z = slice
        clipCoords.x = Math.round(parseInt(dsInfo["imageDims"]["x"]) / 2 / 4) * 4
        clipCoords.y = Math.round(parseInt(dsInfo["imageDims"]["y"]) / 2 / 4) * 4

        sceneXY = new THREE.Scene()
        let color = pickr2.getColor().toRGBA()
        sceneXY.background = new THREE.Color(`rgb(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])})`)

        cameraXY = new THREE.PerspectiveCamera(30, xyDiv.offsetWidth / Math.floor(window.innerHeight * 0.25), .1, 5000)
        cameraXY.position.set(0, 0, parseInt(dsInfo["imageDims"]["x"])) // 
        controlsXY = new OrbitControls(cameraXY, rendererXY.domElement)

        controlsXY.target.set(0, 0, 0) // view direction perpendicular to XY-plane
        controlsXY.enableRotate = false
        controlsXY.enableZoom = true
        controlsXY.zoomToCursor = true
        controlsXY.maxDistance = 4000 //@hardcode
        controlsXY.minDistance = 150 //@hardcode

        geometry = new THREE.PlaneBufferGeometry(dsInfo['dims2']['x'], dsInfo['dims2']['y'])
        //  ("geometry",geometry)
        material2 = new THREE.MeshBasicMaterial()
        material2.side = THREE.DoubleSide
    }

    if (!supportPass)
        loader.detectSupport(rendererXY)
    supportPass = true

    // Replace the URL below with your SAS URL
    var sasUrl = `https://bivlargefiles.file.core.windows.net/data/${dsInfo['name']}/basis/${modSelect.value}/${exposureSelect.value}/${dsInfo.types[modSelect.value][exposureSelect.value][wavelengthSelect.value]}/xy/${slider.value}.basis?${SAS}`;

    loader.load(sasUrl, function (texture) {
        texture.encoding = THREE.sRGBEncoding
        xyShader.uniforms.u_texture.value = texture
        xyShader.uniforms.u_threshold.value = threshold2D.value / 10
        xyShader.uniforms.u_mod.value = '1.0'
        if (modSelect.value == 'Brightfield')
            xyShader.uniforms.u_mod.value = '0.0'

        xyShader.transparent = true
        mesh = new THREE.Mesh(geometry, xyShader)
        mesh.name = 'mouseSlice'
        mesh.translateX(parseInt((dsInfo["dims2"]["x"]) - parseInt(dsInfo["imageDims"]["x"])) / 2)
        mesh.translateY(parseInt((dsInfo["dims2"]["y"]) - parseInt(dsInfo["imageDims"]["y"])) / 2)
        //  (parseInt((dsInfo["dims2"]["x"]) - parseInt(dsInfo["imageDims"]["x"])) / 2, ((dsInfo["dims2"]["y"]) - parseInt(dsInfo["imageDims"]["y"])) / 2);
        mesh.translateZ(-1)
        sceneXY.add(mesh)
        sceneXY.add(lineTextGroup, XYannTextGroup, brushGroup)


        dControls = new DragControls(XYannTextGroup.children, cameraXY, rendererXY.domElement)

        dControls.addEventListener('dragend', function (event) {
            let arr = event.object.name.split('-')
            if (!arr[1])
                arr[1] = ''
            fetch('/updateAnnotation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'slice': slider.value,
                    'dataset': dsInfo["name"],
                    'moduality': modSelect.value,
                    'exposure': exposureSelect.value,
                    'wavelength': wavelengthSelect.value,
                    'text': arr[0],
                    'instance': arr[1],
                    'x': event.object.position.x,
                    'y': event.object.position.y,
                    'datetime': Date.now()
                }),
            })
                .then(response => response.json())
                .then(data => {
                    let i = annSlices.findIndex(
                        e => e.text == arr[0]
                            && e.instance == arr[1]
                    )

                    annSlices[i].x = event.object.position.x
                    annSlices[i].y = event.object.position.y
                })
                .catch((error) => { console.error('Error:', error) })

        });

        dControls.addEventListener('hoveron', function (event) {
            if (previousHoverObj)
                if (event.object.name != previousHoverObj.name)
                    previousHoverObj.material.color.setHex(0x00ffff)

            previousHoverObj = event.object
            event.object.material.color.setHex(0xffff00)
        });

        dControls.addEventListener('hoveroff', function (event) {
            event.object.material.color.setHex(0x00ffff)
        });


        dControls.addEventListener('dragstart', function (event) {

            draggedAnn = true

        });

        animate2()
        // loadAnnotations()

        loadAnnotationsFast()
        loadMasks()
        loadFiles()
        if (fullLoad)
            loadViews()

        //unlock buttons
        forwardBtn.disabled = false, backBtn.disabled = false, forwardStepBtn.disabled = false, backStepBtn.disabled = false
        createAnnBtn.disabled = false, toggleAnnBtn.disabled = false,
            exportBtn.disabled = false, exportXYZSelect.disabled = false, saveViewBtn.disabled = false,
            // loadViewBtn.disabled = false, delViewBtn.disabled = false,
            // full2dBtnXY.disabled = false,full2dBtnXZ.disabled = false, full2dBtnYZ.disabled = false, 
            full3dBtn.disabled = false, FullScreenBtn.disabled = false,
            measureBtn.disabled = false, maskInput.disabled = false
        modSelect.disabled = false, slider.disabled = false, pixelBox.disabled = false, downloadFileBtn.disabled = false,
            xyInput.disabled = false, annFontNumber.disabled = false
        if (session['level'] == 'admin') {
            fileChooseBtn.disabled = false,
                UploadFileBtn.disabled = false
        }
        if (fileManageBtn != null) {
            fileManageBtn.disabled = false
        }
        if (document.getElementById('orthoTab').classList.contains('active')) {
            loadOrthos()
        }
    }, undefined, function (error) { console.error(error) }
    )

}

function animate2() {
    requestAnimationFrame(animate2)
    lineTextGroup.traverse(function (child) {
        if (child.type == 'Mesh' && cameraXY.position.z < 250) {
            var scaleFactor = 150
            var scale = scaleVector.subVectors(child.position, cameraXY.position).length() / scaleFactor
            child.scale.set(scale, scale, 1)
        }
    })
    XYannTextGroup.traverse(function (child) {
        if (child.type == 'Mesh') {
            if (cameraXY.position.z <= 250) {
                var scaleFactor = 500 * (1 / dsInfo['voxels']['z'] / (annFontNumber.value))
                var scale = scaleVector.subVectors(child.position, cameraXY.position).length() / scaleFactor
                child.scale.set(scale, scale, 1)
            } else {
                //flip the transformation
                var scaleFactor = 500 * (1 / dsInfo['voxels']['z'] / annFontNumber.value) * 1.25
                var scale = scaleVector.subVectors(child.position, cameraXY.position).length() / scaleFactor
                child.scale.set(scale, scale, 1)
            }

        }
    })

    XZannTextGroup.traverse(function (child) {
        if (child.type == 'Mesh') {
            if (oCameras['xz'].position.z <= 250) {
                var scaleFactor = 500 * (1 / dsInfo['voxels']['z'] / (annFontNumber.value))
                var scale = scaleVector.subVectors(child.position, oCameras['xz'].position).length() / scaleFactor
                child.scale.set(scale, scale, 1)
            } else {
                //flip the transformation
                var scaleFactor = 500 * (1 / dsInfo['voxels']['z'] / annFontNumber.value) * 1.25
                var scale = scaleVector.subVectors(child.position, oCameras['xz'].position).length() / scaleFactor
                child.scale.set(scale, scale, 1)
            }

        }
    })

    YZannTextGroup.traverse(function (child) {
        if (child.type == 'Mesh') {
            if (oCameras['yz'].position.z <= 250) {
                var scaleFactor = 500 * (1 / dsInfo['voxels']['z'] / (annFontNumber.value))
                var scale = scaleVector.subVectors(child.position, oCameras['yz'].position).length() / scaleFactor
                child.scale.set(scale, scale, 1)
            } else {
                //flip the transformation
                var scaleFactor = 500 * (1 / dsInfo['voxels']['z'] / annFontNumber.value) * 1.25
                var scale = scaleVector.subVectors(child.position, oCameras['yz'].position).length() / scaleFactor
                child.scale.set(scale, scale, 1)
            }

        }
    })

    xyShader.uniforms.u_threshold.value = threshold2D.value / 10
    rendererXY.render(sceneXY, cameraXY)

    // oRenderers['yz'].render(sceneYZ, oCameras['yz']);
}

pixelBox.addEventListener('click', pixelIntensity)
/***
 * 
 * TODO IMPROVE PERFORMANCE
 * https://stackoverflow.com/questions/35005603/get-color-of-the-texture-at-uv-coordinate
 * Get UV coords from a raycaster
 * Current way is bad because it redraws canvas every mouse move
 */
function pixelIntensity() {
    if (!pixelBox.checked) {
        document.getElementById("pixelSpan").innerHTML = `&nbsp`
        rendererXY.domElement.removeEventListener("mousemove", canvasPixelEvent)
    } else
        rendererXY.domElement.addEventListener("mousemove", canvasPixelEvent)
}

function canvasPixelEvent(e) {
    var twoDeeCanvasImage = document.getElementById('pixelHolder')
    twoDeeCanvasImage.width = canvasXY.width
    twoDeeCanvasImage.height = canvasXY.height
    let ctx2D = twoDeeCanvasImage.getContext('2d')
    ctx2D.drawImage(canvasXY, 0, 0)

    let p = ctx2D.getImageData(e.offsetX, e.offsetY, 1, 1).data
    document.getElementById("pixelSpan").innerHTML = `RGBA(${p[0]},${p[1]},${p[2]},${p[3]})`

    canvasXY.addEventListener("mouseout", () => {
        document.documentElement.style.cursor = "default";
    })
}

let measureCoords = []
let clickHandler = {
    set: function (obj, prop, value) {
        //
        if (prop === 'count') {
            if (value[0] > 1) {
                value[0] = 0
                canvasXY.removeEventListener("click", getSceneClicks)

                canvasXY.addEventListener("click", orthoClick)

                document.getElementById("measureBtn").disabled = false
                //document.getElementById("createMaskBtn").disabled = false
                document.getElementById("measureClearBtn").disabled = false
                drawLine()
                document.documentElement.style.cursor = 'default'
            }
        }
        obj[prop] = value[0]
        return true;
    }
};

const clicks = new Proxy({}, clickHandler)
clicks.count = [0, null]
measureBtn.addEventListener('click', () => {
    measureBtn.disabled = true
    //createMaskBtn.disabled = true
    canvasXY.removeEventListener("click", orthoClick)
    canvasXY.addEventListener("click", getSceneClicks)
    document.documentElement.style.cursor = 'crosshair'
})

measureClearBtn.addEventListener('click', () => {
    measureBtn.disabled = false
    measureClearBtn.disabled = true

    lineTextGroup.remove(...lineTextGroup.children)
})

function cursorStyler(type) {
    document.documentElement.style.cursor = type
}

let brushflag = false

/***MASK V2 SECTION */
maskInput.addEventListener("input", enableDrawing)

function enableDrawing() {
    if (maskInput.value != '')
        startMaskBtn.disabled = false
    else
        startMaskBtn.disabled = true
}

let vertsHolder = []

function clearMask() {
    // ('hi')
    //handled in updateSlice
    //brushGroup.remove(...brushGroup.children)
}

function drawMask() {
    var MAX_POINTS = 5000
    //var positions = new Float32Array( MAX_POINTS * 3 ); // 3 vertices per point
    //maskGeometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );

    for (let i = 0; i < vertsHolder.length; i++) {
        if (vertsHolder[i].slice == slider.value) {
            // (slider.value)
            // (vertsHolder[i].verts)
            let maskIndex = 0;
            maskGeometry = new THREE.BufferGeometry()
            var positions = new Float32Array(MAX_POINTS * 3); // 3 vertices per point
            maskGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            for (let index = 0; index < vertsHolder[i].verts.length; index += 2) {
                positions[maskIndex++] = vertsHolder[i].verts[index]
                positions[maskIndex++] = vertsHolder[i].verts[index + 1]
                positions[maskIndex++] = 1
            }
            maskMaterial = new THREE.LineBasicMaterial({
                color: 0x0000ff,
                linewidth: 10
            });
            var line = new THREE.LineLoop(maskGeometry, maskMaterial) //line
            brushGroup.add(line)
            line.frustumCulled = false
            line.geometry.setDrawRange(0, maskIndex / 3)
            line.geometry.attributes.position.needsUpdate = true;
        }

    }

}


startMaskBtn.addEventListener('click', () => {
    startMaskBtn.disabled = true
    maskInput.disabled = true
    maskLoadInput.disabled = true
    loadMaskBtn.disabled = true
    eraseMaskBtn.disabled = false
    finishedMaskBtn.disabled = false

    //disable crosshairs
    canvasXY.removeEventListener("click", orthoClick)
    xyInput.addEventListener("input", clearMask)
    //add event handler for mouse down/up on canvas
    brushflag = true
    canvasXY.addEventListener("mousedown", (e) => {

        let rect = canvasXY.getBoundingClientRect()
        var MAX_POINTS = 5000
        maskGeometry = new THREE.BufferGeometry()

        //if ( !brushflag ){
        //     ("brushflag tripped")
        //maskGeometry.setAttribute( 'position', null );
        //    return
        //} else {
        var positions = new Float32Array(MAX_POINTS * 3); // 3 vertices per point
        maskGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        // draw range
        let drawCount = 0,
            maskIndex = 0
        maskGeometry.setDrawRange(0, drawCount);

        maskMaterial = new THREE.LineBasicMaterial({
            color: 0x0000ff,
            linewidth: 10
        });

        var line = new THREE.LineLoop(maskGeometry, maskMaterial) //line
        line.frustumCulled = false
        brushGroup.add(line)
        canvasXY.onmousemove = function d(evt) {
            let x = ((evt.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1
            let y = - ((evt.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1
            rayCaster.setFromCamera({ 'x': x, 'y': y }, cameraXY)
            var intersects = []
            mesh.raycast(rayCaster, intersects)
            if (intersects.length > 0) {
                positions[maskIndex++] = intersects[0].point.x
                positions[maskIndex++] = intersects[0].point.y

                positions[maskIndex++] = 0
                line.geometry.setDrawRange(0, drawCount++)
                intersects = []
                line.geometry.attributes.position.needsUpdate = true;
            }
        }
        //}
    })

    canvasXY.addEventListener("mouseup", function (e) {
        //save the points to obj here
        //if( maskGeometry.getAttribute('position') == null)
        //    return
        let allVerts = maskGeometry.getAttribute('position')['array']
        let verts = []
        for (let v = 0; v < allVerts.length; v++) {
            //end of array hack to satisfy using buffergeom
            if (
                allVerts[v] == 0 &&
                allVerts[v + 3] == 0 &&
                allVerts[v + 6] == 0 &&
                (v + 1) % 3 == 1
            )
                break

            if ((v + 1) % 3 != 0)
                verts.push(allVerts[v])
        }
        let slice = xyInput.value
        let index = -1
        index = vertsHolder.map(e => e.slice).indexOf(slice);
        if (index != -1) {
            vertsHolder[index].verts = vertsHolder[index].verts.concat(verts);
        } else {
            vertsHolder.push({ slice: slice, verts: verts })
        }

        // (vertsHolder)
        //update stats
        if (!document.getElementById('minSlice').value || document.getElementById('minSlice').value > slice)
            document.getElementById('minSlice').value = slice
        if (!document.getElementById('maxSlice').value || document.getElementById('maxSlice').value < slice)
            document.getElementById('maxSlice').value = slice

        document.getElementById('totalSlices').value = Object.keys(vertsHolder).length
        canvasXY.onmousemove = null
    })


    //each up will save lineloop to array
})


eraseMaskBtn.addEventListener('click', () => {
    brushGroup.remove(...brushGroup.children)
})

finishedMaskBtn.addEventListener('click', () => {
    //alert if no lineloops
    //restore crosshairs
    canvasXY.addEventListener("click", orthoClick)
    //reset btns
    //startMaskBtn.disabled = false
    maskInput.disabled = false

    eraseMaskBtn.disabled = true
    finishedMaskBtn.disabled = true
    /* THIS WORKED
    const masksArray = vertsHolder.map(function(elem)
    {
        elem.mask = Array.from(Array(parseInt(dsInfo["imageDims"]["y"])), _ => Array(parseInt(dsInfo["imageDims"]["x"])).fill(0));
        for(let counter = 0; counter < elem.verts.length; counter +=2){
        try {
        //we lose some precision because we have to round
            elem.mask
                [Math.round(elem.verts[counter+1] + (dsInfo["imageDims"]["y"] / 2))]
                [Math.round(elem.verts[counter] + (dsInfo["imageDims"]["x"] / 2)) ]
                = 1;
        }
        catch (error) {
        }
    }
        //if this comes close to freezing the browser then we should consider doing this server side
        return elem
    } ); */

    fetch('/saveMaskNoInterpolation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'dataset': dsInfo["name"],
            'name': document.getElementById('maskInput').value,
            'verts': vertsHolder,
            //'mask': masksArray,
            'minSlice': document.getElementById('minSlice').value,
            'maxSlice': document.getElementById('maxSlice').value,
            'datetime': Date.now()
        }),
    })
        .then(response => response.json())
        .then(data => {
            //slow iteration, see if there's a modern approach
            vertsHolder = []
            let verts = [];
            for (let s = 0; s < data.length; s++) {
                if ('verts' in data[s]) {
                    vertsHolder.push({ slice: data[s].slice, verts: data[s].verts })
                }
                else {
                    let rawMask = data[s].mask
                    //generated
                    for (let y = 0; y < rawMask.length; y++) {
                        for (let x = 0; x < rawMask[y].length; x++) {
                            if (rawMask[y][x] > 0) {
                                verts.push(x - (dsInfo["imageDims"]["x"] / 2))
                                verts.push(y - (dsInfo["imageDims"]["y"] / 2))

                            }
                        }
                    }
                    //issue 1: need to order it as if it was drawn
                    vertsHolder.push({ slice: data[s].slice, verts: verts })
                    verts = []
                }
            }
            drawMask()
            loadMasks()
            maskLoadInput.disabled = false
            loadMaskBtn.disabled = false
        })
        .catch((error) => {
            console.error('Error:', error)
        })
})

function loadMasks() {
    fetch('/getMasks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'dataset': dsInfo["name"]
        }),
    })
        .then(response => response.json())
        .then(data => {
            maskLoadInput.disabled = false
            // maskInput.value = ''
            brushGroup.remove(...brushGroup.children)
            brushflag = false
            let maskTableBody = document.getElementById("maskTbody")
            maskTableBody.innerHTML = ``
            for (let i = 0; i < data.length; i++) {
                loadMaskBtn.disabled = false
                var newRow = maskTableBody.insertRow()
                let dt = new Date(data[i]['datetime'])
                newRow.insertCell(0).appendChild(document.createTextNode(data[i]['name']))
                newRow.insertCell(1).appendChild(document.createTextNode(data[i]['interpolated']))
                newRow.insertCell(2).appendChild(document.createTextNode(dt.toDateString()))
                newRow.insertCell(3).appendChild(document.createTextNode(data[i]['user'].split("@")[0]))
            }
        })
        .catch((error) => {
            console.error('Error:', error)
        })

}

maskLoadInput = document.getElementById("maskLoadInput"),
    loadMaskBtn.addEventListener("click", () => {
        if (maskLoadInput.value == '')
            return //maybe alert

        fetch('/getMaskSlices', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                'dataset': dsInfo["name"],
                'name': maskLoadInput.value
            }),
        })
            .then(response => response.json())
            .then(data => {
                //slow iteration, see if there's a modern approach
                vertsHolder = []
                let verts = [];
                for (let s = 0; s < data.length; s++) {
                    if ('verts' in data[s]) {
                        vertsHolder.push({ slice: data[s].slice, verts: data[s].verts })
                    }
                    else {
                        let rawMask = data[s].mask
                        //generated
                        for (let y = 0; y < rawMask.length; y++) {
                            for (let x = 0; x < rawMask[y].length; x++) {
                                if (rawMask[y][x] > 0) {
                                    verts.push(x - (dsInfo["imageDims"]["x"] / 2))
                                    verts.push(y - (dsInfo["imageDims"]["y"] / 2))

                                }
                            }
                        }
                        vertsHolder.push({ slice: data[s].slice, verts: verts })
                        verts = []
                    }

                }
                drawMask() // Go to slice automatically?

                // maskInput.value = maskLoadInput.value
                //view only or edits?
                //eraseMaskBtn.disabled = false
                // maskLoadInput.value = ''

            })
            .catch((error) => {
                alert("No masks found with that name")
            })

    })

/*** END SECTION */

function getSceneClicks(evt) {
    let rect = canvasXY.getBoundingClientRect()
    mouse.x = ((evt.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
    mouse.y = - ((evt.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

    rayCaster.setFromCamera(mouse, cameraXY);
    var intersects = []
    mesh.raycast(rayCaster, intersects)
    if (intersects.length > 0) {
        measureCoords[clicks.count] = intersects[0].point
        clicks.count = [clicks.count + 1, intersects[0].uv]
    }
}

function drawLine() {
    var material3 = new THREE.LineBasicMaterial({
        color: 0xFF0000,
        linewidth: 6,
        transparent: true
    })

    var geometry3 = new THREE.Geometry();
    if (measureCoords[0].x > measureCoords[1].x) {
        let temp = measureCoords[0].x
        measureCoords[0].x = measureCoords[1].x
        measureCoords[1].x = temp
        temp = measureCoords[0].y
        measureCoords[0].y = measureCoords[1].y
        measureCoords[1].y = temp

    }

    geometry3.vertices.push(
        new THREE.Vector3(measureCoords[0].x, measureCoords[0].y + 5, 0.5),
        new THREE.Vector3(measureCoords[0].x, measureCoords[0].y - 5, 0.5),
        new THREE.Vector3(measureCoords[0].x, measureCoords[0].y, 0.5),
        new THREE.Vector3(measureCoords[1].x, measureCoords[1].y, 0.5),
        new THREE.Vector3(measureCoords[1].x, measureCoords[1].y - 5, 0.5),
        new THREE.Vector3(measureCoords[1].x, measureCoords[1].y + 5, 0.5),
    )

    var middleX = measureCoords[1].x - measureCoords[0].x
    var middleY = measureCoords[1].y - measureCoords[0].y
    var pixelDistance = Math.sqrt(Math.pow(middleX, 2) + Math.pow(middleY, 2))
    pixelDistance = pixelDistance.toFixed(4)
    var line = new THREE.Line(geometry3, material3)

    lineTextGroup.add(line)
    var texture_placeholder = document.createElement('canvas');
    texture_placeholder.width = 100;
    texture_placeholder.height = 20;
    var context = texture_placeholder.getContext('2d');
    context.clearRect(0, 0, 100, 20)
    context.fillStyle = '#00FFFF';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = '3px';
    context.fillText(`${(pixelDistance * dsInfo['info']['voxels']).toFixed(2)}µ`, texture_placeholder.width / 2, texture_placeholder.height / 2);
    var texture = new THREE.Texture(texture_placeholder);
    texture.needsUpdate = true;
    var material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
    var plane = new THREE.PlaneGeometry(100, 20);
    var text = new THREE.Mesh(plane, material)
    text.translateX(measureCoords[0].x + (middleX / 2))
    text.translateY(measureCoords[0].y + (middleY / 2) - 5)
    text.rotateZ(Math.atan2(middleY, middleX))
    lineTextGroup.add(text)

}

function drawAnnotation(p, t, x, y) {
    //  (p, t, x, y)
    let multiT = t.match(/.{1,12}/g);
    var texture_placeholder = document.createElement('canvas');
    texture_placeholder.width = 60;
    texture_placeholder.height = 15;
    var context = texture_placeholder.getContext('2d');
    context.clearRect(0, 0, 60, 10)
    context.fillStyle = '#00FFFF';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `${annFontNumber.value}px`;
    for (let l = 0; l < multiT.length; l++)
        context.fillText(`${multiT[l]}`, 60 / 2, texture_placeholder.height * (l + 1 * .5) / 2);
    var texture = new THREE.Texture(texture_placeholder);
    texture.needsUpdate = true;
    var material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true });
    var plane = new THREE.PlaneGeometry(60, 10 * multiT.length);
    var text = new THREE.Mesh(plane, material)
    text.translateX(x)
    text.translateY(y)
    text.name = t
    if (p == "XY") {
        XYannTextGroup.add(text)
    }
    else if (p == "YZ") {
        YZannTextGroup.add(text)
    }
    else if (p == "XZ") {
        XZannTextGroup.add(text)
    }

    YZannTextGroup.children.forEach(child => {
        child.position.z = 0.1;  // 调整z轴坐标使注释位于图像平面之前
    });
    XZannTextGroup.children.forEach(child => {
        child.position.z = 0.1;  // 调整z轴坐标使注释位于图像平面之前
    });
}


function loadViews() {
    const viewsTableBody = document.querySelector('#viewsTable tbody');
    viewsTableBody.innerHTML = "";
    fetch('/getView', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'dataset': dsInfo["name"]
        }),
    })
        .then(response => response.json())
        .then(data => {
            for (let i = 0; i < data.length; i++) {
                let row = document.createElement('tr');

                // 第一列：View Name
                let nameCell = document.createElement('td');
                nameCell.textContent = data[i]['name'];
                row.appendChild(nameCell);

                // 第二列：Buttons
                let buttonCell = document.createElement('td');

                // Load button
                let loadButton = document.createElement('button');
                loadButton.classList.add('btn', 'btn-primary', 'mr-2', 'btn-icon');
                loadButton.innerHTML = '<i class="fas fa-download"></i>';
                loadButton.onclick = function () {
                    loadView(data[i]['name']);
                };
                buttonCell.appendChild(loadButton);

                // Delete button
                let deleteButton = document.createElement('button');
                deleteButton.classList.add('btn', 'btn-danger', 'mr-2', 'btn-icon');
                deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
                deleteButton.onclick = function () {
                    deleteView(data[i]['name']);
                };
                buttonCell.appendChild(deleteButton);

                // Detail button
                if (session['level'] === 'admin') {
                    console.log("can see")
                    let detailButton = document.createElement('button');
                    detailButton.classList.add('btn', 'btn-info', 'btn-icon');
                    detailButton.innerHTML = '<i class="fas fa-info-circle"></i>';
                    detailButton.onclick = function () {
                        viewDetail(data[i]['name']);
                    };
                    buttonCell.appendChild(detailButton);
                }

                row.appendChild(buttonCell);
                viewsTableBody.appendChild(row);
            }
        })
        .catch((error) => { console.error('Error:', error) });
}

// Load view function
function loadView(viewName) {
    ('Loading view:', viewName); // 调试信息
    if (!viewName) return;

    fetch('/getView', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'dataset': dsInfo["name"],
            'name': viewName
        }),
    })
        .then(response => response.json())
        .then(data => {
            slider.value = data["slice"];
            xyInput.value = data["slice"];
            modSelect.value = data["moduality"];
            changeExposure();
            exposureSelect.value = data["exposure"];
            changeWavelength();
            wavelengthSelect.selectedIndex = data["wavelength"];
            updateSlice();
            cameraXY.position.set(data["x"], data["y"], data["z"]);
            controlsXY.target.set(data["x"], data["y"], -7);
            controlsXY.update();
            threshold2D.value = parseInt(data['threshold']);
            let modFloat = '1.0';
            if (modSelect.value == 'Brightfield')
                modFloat = '0.0';
            xyShader.uniforms.u_mod.value = modFloat;

            document.getElementById('orthoTab').click();

            oMaterials['xz'].uniforms.u_mod.value = modFloat;
            oMaterials['yz'].uniforms.u_mod.value = modFloat;
            oCameras['xz'].position.set(data["xxz"], data["yxz"], data["zxz"]);
            oControls['xz'].target.set(data["xxz"], data["yxz"], -7);
            oControls['xz'].update();

            oCameras['yz'].position.set(data["xyz"], data["yyz"], data["zyz"]);
            oControls['yz'].target.set(data["xyz"], data["yyz"], -7);
            oControls['yz'].update();

            clipCoords.x = data["xClip"];
            clipCoords.y = data["yClip"];
            updateOrthoMeshes();

            let points = [];
            points.push(new THREE.Vector3(
                data["xClip"] - parseInt(dsInfo["imageDims"]["x"] / 2),
                -(parseInt(dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"]) / 2),
                1
            ));
            points.push(new THREE.Vector3(
                data["xClip"] - parseInt(dsInfo["imageDims"]["x"] / 2),
                (parseInt(dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"]) / 2),
                1
            ));

            xzVertLineGeom.setFromPoints(points);
            xzVertLine.geometry.attributes.position.needsUpdate = true;
            xzVertLine.geometry.computeBoundingSphere();

            points = [];
            points.push(new THREE.Vector3(
                data["yClip"] - parseInt(dsInfo["imageDims"]["y"] / 2),
                -(parseInt(dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"]) / 2),
                1
            ));
            points.push(new THREE.Vector3(
                data["yClip"] - parseInt(dsInfo["imageDims"]["y"] / 2),
                (parseInt(dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"]) / 2),
                1
            ));

            yzVertLineGeom.setFromPoints(points);
            yzVertLine.geometry.attributes.position.needsUpdate = true;
            yzVertLine.geometry.computeBoundingSphere();

            points = [];
            points.push(new THREE.Vector3(data["xClip"] - parseInt(dsInfo["imageDims"]["x"] / 2), -dsInfo["imageDims"]["y"] / 2, 1));
            points.push(new THREE.Vector3(data["xClip"] - parseInt(dsInfo["imageDims"]["x"] / 2), dsInfo["imageDims"]["y"] / 2, 1));

            xLineGeom.setFromPoints(points);
            xLine.geometry.attributes.position.needsUpdate = true;
            xLine.geometry.computeBoundingSphere();

            points = [];
            points.push(new THREE.Vector3(-dsInfo["imageDims"]["x"] / 2, data["yClip"] - parseInt(dsInfo["imageDims"]["y"] / 2), 1));
            points.push(new THREE.Vector3(dsInfo["imageDims"]["x"] / 2, data["yClip"] - parseInt(dsInfo["imageDims"]["y"] / 2), 1));
            yLineGeom.setFromPoints(points);
            yLine.geometry.attributes.position.needsUpdate = true;
            yLine.geometry.computeBoundingSphere();
            (session)
            updateViewDetail(viewName, dsInfo["name"]);
        })
        .catch((error) => { console.error('Error:', error); });
}

function updateViewDetail(viewName, dataset) {
    fetch('/updateViewDetail', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'dataset': dataset,
            'name': viewName,
            'user': session['email']  // 当前用户的邮箱
        }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                ('View detail updated successfully');
            } else {
                console.error('Failed to update view detail');
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Delete view function
function deleteView(viewName) {
    if (viewName == '')
        return

    fetch('/delView', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'dataset': dsInfo["name"],
            'name': viewName
        }),
    })
        .then(response => response.json())
        .then(() => {
            loadViews()
        })
}

// View detail function
function viewDetail(viewName) {
    fetch('/getView', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'dataset': dsInfo["name"],
            'name': viewName
        }),
    })
        .then(response => response.json())
        .then(data => {
            ("getView", data)
            document.getElementById('viewNameDetail').textContent = data.name;
            document.getElementById('viewCreatorDetail').textContent = data.user;
            const totalLoadTimes = data.Visit.reduce((sum, visit) => sum + visit.count, 0);
            document.getElementById('loadtimesDetail').textContent = totalLoadTimes;

            const tableBody = document.getElementById('viewDetailsTableBody');
            tableBody.innerHTML = '';

            data.Visit.forEach(visit => {
                const row = document.createElement('tr');

                const LoadUser = document.createElement('td');
                LoadUser.textContent = visit.User;
                row.appendChild(LoadUser);

                const Count = document.createElement('td');
                Count.textContent = visit.count;
                row.appendChild(Count);

                const LastTime = document.createElement('td');
                LastTime.textContent = visit.lastVisit;
                row.appendChild(LastTime);

                tableBody.appendChild(row);
            });


            // 显示模态框
            $('#viewDetailModal').modal('show');
        })
        .catch(error => {
            console.error('Error:', error);
        });
}




// delViewBtn.addEventListener("click", () => {
//     if (viewSelect.value == '')
//         return

//     fetch('/delView', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//             'dataset': dsInfo["name"],
//             'name': viewSelect.value
//         }),
//     })
//         .then(response => response.json())
//         .then(() => {
//             loadViews()
//         })

// })

// loadViewBtn.addEventListener("click", () => {
//     //viewSelect.addEventListener("change", () => {
//     if (viewSelect.value == '')
//         return
//     /* Not sure if we will do this the same as annotations
//     let arr = event.object.name.split('-')
//         if ( !arr[1] )
//             arr[1] = null
//     */

//     fetch('/getView', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({
//             'dataset': dsInfo["name"],
//             'name': viewSelect.value
//         }),
//     })
//         .then(response => response.json())
//         .then(data => {
//             slider.value = data["slice"]
//             xyInput.value = data["slice"]
//             //if 3D is active maybe just switch to orthos?

//             //zclip.value = slider.value
//             modSelect.value = data["moduality"]
//             //updates the options
//             changeExposure()
//             exposureSelect.value = data["exposure"] //WRONG START HERE AFTER LUNCH
//             changeWavelength()
//             wavelengthSelect.selectedIndex = data["wavelength"]
//             //wavelengthSelect.value = data["wavelength"] //WRONG
//             updateSlice()
//             cameraXY.position.set(data["x"], data["y"], data["z"])
//             controlsXY.target.set(data["x"], data["y"], -7)
//             controlsXY.update()
//             threshold2D.value = parseInt(data['threshold'])
//             let modFloat = '1.0'
//             if (modSelect.value == 'Brightfield')
//                 modFloat = '0.0'
//             xyShader.uniforms.u_mod.value = modFloat

//             document.getElementById('orthoTab').click()

//             oMaterials['xz'].uniforms.u_mod.value = modFloat
//             oMaterials['yz'].uniforms.u_mod.value = modFloat
//             //just write what we need to happen and abstract later
//             oCameras['xz'].position.set(data["xxz"], data["yxz"], data["zxz"])
//             oControls['xz'].target.set(data["xxz"], data["yxz"], -7)
//             oControls['xz'].update()

//             oCameras['yz'].position.set(data["xyz"], data["yyz"], data["zyz"])
//             oControls['yz'].target.set(data["xyz"], data["yyz"], -7)
//             oControls['yz'].update()
//             //need to handle vertical lines here, update slice handles horizontal
//             //need to update orthos as well
//             clipCoords.x = data["xClip"]
//             clipCoords.y = data["yClip"]
//             updateOrthoMeshes()

//             let points = [];
//             points.push(new THREE.Vector3(
//                 data["xClip"] - parseInt(dsInfo["imageDims"]["x"] / 2),
//                 -(parseInt(dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"]) / 2),
//                 1
//             ));
//             points.push(new THREE.Vector3(
//                 data["xClip"] - parseInt(dsInfo["imageDims"]["x"] / 2),
//                 (parseInt(dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"]) / 2),
//                 1
//             ));

//             xzVertLineGeom.setFromPoints(points)
//             xzVertLine.geometry.attributes.position.needsUpdate = true
//             xzVertLine.geometry.computeBoundingSphere();

//             points = [];
//             points.push(new THREE.Vector3(
//                 data["yClip"] - parseInt(dsInfo["imageDims"]["y"] / 2),
//                 -(parseInt(dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"]) / 2),
//                 1
//             ));
//             points.push(new THREE.Vector3(
//                 data["yClip"] - parseInt(dsInfo["imageDims"]["y"] / 2),
//                 (parseInt(dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"]) / 2),
//                 1
//             ));

//             yzVertLineGeom.setFromPoints(points)
//             yzVertLine.geometry.attributes.position.needsUpdate = true
//             yzVertLine.geometry.computeBoundingSphere();

//             points = []
//             points.push(new THREE.Vector3(data["xClip"] - parseInt(dsInfo["imageDims"]["x"] / 2), -dsInfo["imageDims"]["y"] / 2, 1));
//             points.push(new THREE.Vector3(data["xClip"] - parseInt(dsInfo["imageDims"]["x"] / 2), dsInfo["imageDims"]["y"] / 2, 1));

//             xLineGeom.setFromPoints(points);
//             xLine.geometry.attributes.position.needsUpdate = true
//             xLine.geometry.computeBoundingSphere();

//             points = [];
//             points.push(new THREE.Vector3(-dsInfo["imageDims"]["x"] / 2, data["yClip"] - parseInt(dsInfo["imageDims"]["y"] / 2), 1));
//             points.push(new THREE.Vector3(dsInfo["imageDims"]["x"] / 2, data["yClip"] - parseInt(dsInfo["imageDims"]["y"] / 2), 1));
//             yLineGeom.setFromPoints(points);
//             yLine.geometry.attributes.position.needsUpdate = true
//             yLine.geometry.computeBoundingSphere();


//             viewSelect.selectedIndex = -1;
//         })
//         .catch((error) => { console.error('Error:', error) })
// })

function populateInfoTable() {
    let dsDiv = document.getElementById("dsCard")
    //dsDiv.innerHTML = ``
    document.getElementById('InstitutionName').innerHTML = `${dsInfo['institution']}`
    document.getElementById('specimenInfo').innerHTML = `${dsInfo['info']['specimen']}`
    document.getElementById('piInfo').innerHTML = `${dsInfo['info']['PI']}`
    document.getElementById('voxelInfo').innerHTML = `${dsInfo['info']['voxels']}μ`
    document.getElementById('thicknessInfo').innerHTML = `${dsInfo['info']['thickness']}μ`
}

function processNewAnn(evt) {
    let rect = canvasXY.getBoundingClientRect()
    mouse.x = ((evt.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
    mouse.y = - ((evt.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

    rayCaster.setFromCamera(mouse, cameraXY);
    var intersects = []
    mesh.raycast(rayCaster, intersects)
    if (intersects.length > 0) {
        canvasXY.removeEventListener("click", processNewAnn)
        let txtBox = document.createElement("input")
        txtBox.id = 'annTextBox'
        txtBox.type = "text"
        txtBox.width = 80
        txtBox.height = 20
        txtBox.maxLength = 30 //hotfix for text getting chopped off
        txtBox.style.position = "absolute"
        xyDiv.appendChild(txtBox)
        txtBox.style.zIndex = "10"
        txtBox.style.left = evt.offsetX + canvasXY.offsetLeft + "px"
        txtBox.style.top = evt.offsetY + canvasXY.offsetTop + "px"
        txtBox.focus()

        document.addEventListener('focus', function focusEvent() {
            if (txtBox) {
                txtBox.parentNode.removeChild(txtBox)
                txtBox = null
                canvasXY.addEventListener("click", orthoClick)
                createAnnBtn.disabled = false
            }
        }, true);

        txtBox.addEventListener("keyup", function (e) {
            txtBox.value = txtBox.value.replace(/[-]/g, '')
            if (e.keyCode === 13 && txtBox.value != '') { //if (event.key !== undefined) { chrome doesn't support this yet
                fetch('/saveAnnotation', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        'slice': parseInt(slider.value),
                        'plane': 'XY',
                        'dataset': dsInfo["name"],
                        'moduality': modSelect.value,
                        'exposure': exposureSelect.value,
                        'wavelength': wavelengthSelect.value,
                        'text': txtBox.value,
                        'x': intersects[0].point.x,
                        'y': intersects[0].point.y,
                        'datetime': Date.now()
                    }),
                })
                    .then(response => response.json())
                    .then(data => {
                        // (data.length)
                        //for (let i = 0; i < data.length; i++){
                        let annTxt = data['text']
                        if (data['instance'])
                            annTxt += '-' + data['instance']
                        drawAnnotation("XY", annTxt, data['x'], data['y'])

                        var newRow = annTableBody.insertRow()

                        let dt = new Date(data['datetime'])


                        var btn = document.createElement('input');
                        btn.type = "button";
                        btn.className = "btn btn-warning";
                        btn.value = 'Edit';
                        btn.setAttribute('data-toggle', 'modal')
                        btn.setAttribute('data-target', '#annotationModal')
                        btn.setAttribute('data-text', data['text'])
                        btn.setAttribute('data-instance', data['instance'] ? data['instance'] : '0')
                        btn.setAttribute('data-comments', data['comments'] ? data['comments'] : '')

                        newRow.insertCell(0).appendChild(btn)
                        newRow.insertCell(1).appendChild(document.createTextNode(data['text']))
                        newRow.insertCell(2).appendChild(document.createTextNode(data['plane']))
                        newRow.insertCell(3).appendChild(document.createTextNode(data['slice']))
                        newRow.insertCell(4).appendChild(document.createTextNode(data['instance'] ? data['instance'] : '0'))
                        newRow.insertCell(5).appendChild(document.createTextNode(dt.toDateString()))
                        newRow.insertCell(6).appendChild(document.createTextNode(data['user'].split("@")[0]))
                        createAnnBtn.disabled = false

                        annSlices.push(
                            {
                                "comments": "",
                                "datetime": data['datetime'],
                                "exposure": exposureSelect.value,
                                "instance": data['instance'],
                                "moduality": modSelect.value,
                                "slice": data['slice'],
                                "plane": "XY",
                                "status": "active",
                                "text": data['text'],
                                "user": data['user'],
                                "wavelength": wavelengthSelect.value,
                                "x": data['x'],
                                "y": data['y']
                            }
                        )
                        //}
                    })
                    .catch((error) => { console.error('Error:', error) })

                xyDiv.removeChild(this)
                txtBox = null
                canvasXY.addEventListener("click", orthoClick)
                canvasXZ.addEventListener("click", xzClick)
                canvasYZ.addEventListener("click", yzClick)

                canvasYZ.removeEventListener("click", processNewAnnYZ); // 针对 YZ 平面的处理函数
                canvasXZ.removeEventListener("click", processNewAnnXZ);
                createAnnBtn.disabled = false
            }
        })
    }
}

function addAnnotationEvents() {

    // 动态创建注释的事件处理
    if (!createAnnBtn.hasAttribute('data-listener')) {
        //  ("ssss")
        createAnnBtn.addEventListener("click", dynamicCreateAnn);
        createAnnBtn.setAttribute('data-listener', 'true'); // 标记已添加监听器
    }

    function dynamicCreateAnn() {
        createAnnBtn.disabled = true;

        canvasXY.removeEventListener("click", orthoClick);
        canvasYZ.removeEventListener("click", yzClick);
        canvasXZ.removeEventListener("click", xzClick);


        canvasXY.addEventListener("click", processNewAnn);
        canvasYZ.addEventListener("click", processNewAnnYZ); // 针对 YZ 平面的处理函数
        canvasXZ.addEventListener("click", processNewAnnXZ);
        // canvasXZ.addEventListener("click", processNewAnn); // 针对 XZ 平面的处理函数
    }

    // 切换注释显示状态的事件处理
    if (!toggleAnnBtn.hasAttribute('data-listener')) {
        toggleAnnBtn.addEventListener("click", toggleAnnotations);
        toggleAnnBtn.setAttribute('data-listener', 'true'); // 标记已添加监听器
    }

    function toggleAnnotations() {
        if (toggleAnnBtn.innerHTML == 'Hide Annotations') {
            XYannTextGroup.visible = false;
            YZannTextGroup.visible = false;
            XZannTextGroup.visible = false;
            createAnnBtn.disabled = true;
            toggleAnnBtn.innerHTML = 'Show Annotations';
        } else {
            XYannTextGroup.visible = true;
            YZannTextGroup.visible = true;
            XZannTextGroup.visible = true;
            createAnnBtn.disabled = false;
            toggleAnnBtn.innerHTML = 'Hide Annotations';
        }
    }

    // 移动注释的事件处理
    if (!canvasXY.hasAttribute('data-move-listener')) {
        canvasXY.addEventListener("click", moveAnn);
        canvasXY.setAttribute('data-move-listener', 'true'); // 标记已添加监听器
    }

    function moveAnn() {
        // 这里添加移动注释的代码
    }
}

function processNewAnnYZ(evt) {
    let rect = canvasYZ.getBoundingClientRect();
    mouse.x = ((evt.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
    mouse.y = - ((evt.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

    rayCaster.setFromCamera(mouse, oCameras['yz']);
    var intersects = [];
    oMeshes['yz'].raycast(rayCaster, intersects);  // 确保你已经定义了对应的mesh
    if (intersects.length > 0) {
        canvasYZ.removeEventListener("click", processNewAnnYZ);
        let txtBox = document.createElement("input");
        txtBox.id = 'annTextBoxYZ';
        txtBox.type = "text";
        txtBox.width = 80;
        txtBox.height = 20;
        txtBox.maxLength = 30;
        txtBox.style.position = "absolute";
        yzDiv.appendChild(txtBox);  // 确保你有一个与 canvasYZ 对应的 div
        txtBox.style.zIndex = "10";
        txtBox.style.left = evt.offsetX + canvasYZ.offsetLeft + "px";
        txtBox.style.top = evt.offsetY + canvasYZ.offsetTop + "px";
        txtBox.focus();

        document.addEventListener('focus', function focusEvent() {
            if (txtBox) {
                txtBox.parentNode.removeChild(txtBox);
                txtBox = null;
                canvasYZ.addEventListener("click", orthoClick);
                createAnnBtn.disabled = false;
            }
        }, true);

        txtBox.addEventListener("keyup", function (e) {
            txtBox.value = txtBox.value.replace(/[-]/g, '');
            if (e.keyCode === 13 && txtBox.value != '') {
                fetch('/saveAnnotation', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        'slice': clipCoords[oClip['yz']],  // 确保你有相应的sliderYZ
                        'plane': 'YZ',
                        'dataset': dsInfo["name"],
                        'moduality': modSelect.value,
                        'exposure': exposureSelect.value,
                        'wavelength': wavelengthSelect.value,
                        'text': txtBox.value,
                        'x': intersects[0].point.x,
                        'y': intersects[0].point.y,
                        'datetime': Date.now()
                    }),
                })
                    .then(response => response.json())
                    .then(data => {
                        let annTxt = data['text'];
                        if (data['instance']) {
                            annTxt += '-' + data['instance'];
                        }
                        drawAnnotation('YZ', annTxt, data['x'], data['y']);  // 确保你有一个drawAnnotationYZ函数

                        var newRow = annTableBody.insertRow();  // 确保你有对应的表格

                        let dt = new Date(data['datetime']);

                        var btn = document.createElement('input');
                        btn.type = "button";
                        btn.className = "btn btn-warning";
                        btn.value = 'Edit';
                        btn.setAttribute('data-toggle', 'modal');
                        btn.setAttribute('data-target', '#annotationModal');
                        btn.setAttribute('data-text', data['text']);
                        btn.setAttribute('data-instance', data['instance'] ? data['instance'] : '0');
                        btn.setAttribute('data-comments', data['comments'] ? data['comments'] : '');

                        newRow.insertCell(0).appendChild(btn);
                        newRow.insertCell(1).appendChild(document.createTextNode(data['text']))
                        newRow.insertCell(2).appendChild(document.createTextNode(data['plane']))
                        newRow.insertCell(3).appendChild(document.createTextNode(data['slice']))
                        newRow.insertCell(4).appendChild(document.createTextNode(data['instance'] ? data['instance'] : '0'))
                        newRow.insertCell(5).appendChild(document.createTextNode(dt.toDateString()))
                        newRow.insertCell(6).appendChild(document.createTextNode(data['user'].split("@")[0]))
                        createAnnBtn.disabled = false;

                        annSlices.push(
                            {
                                "comments": "",
                                "datetime": data['datetime'],
                                "exposure": exposureSelect.value,
                                "instance": data['instance'],
                                "moduality": modSelect.value,
                                "slice": data['slice'],
                                "plane": "YZ",
                                "status": "active",
                                "text": data['text'],
                                "user": data['user'],
                                "wavelength": wavelengthSelect.value,
                                "x": data['x'],
                                "y": data['y']
                            }
                        )
                    })
                    .catch((error) => {
                        console.error('Error:', error);
                    });

                yzDiv.removeChild(txtBox);
                txtBox = null;
                canvasXY.addEventListener("click", orthoClick)
                canvasXZ.addEventListener("click", xzClick)
                canvasYZ.addEventListener("click", yzClick)

                canvasXY.removeEventListener("click", processNewAnn);
                canvasXZ.removeEventListener("click", processNewAnnXZ);

                createAnnBtn.disabled = false;


            }
        });
    }
}

function processNewAnnXZ(evt) {
    let rect = canvasXZ.getBoundingClientRect();
    mouse.x = ((evt.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
    mouse.y = - ((evt.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

    rayCaster.setFromCamera(mouse, oCameras['xz']);
    var intersects = [];
    oMeshes['xz'].raycast(rayCaster, intersects);  // 确保你已经定义了对应的mesh
    if (intersects.length > 0) {
        canvasXZ.removeEventListener("click", processNewAnnXZ);
        let txtBox = document.createElement("input");
        txtBox.id = 'annTextBoxXZ';
        txtBox.type = "text";
        txtBox.width = 80;
        txtBox.height = 20;
        txtBox.maxLength = 30;
        txtBox.style.position = "absolute";
        xzDiv.appendChild(txtBox);  // 确保你有一个与 canvasYZ 对应的 div
        txtBox.style.zIndex = "10";
        txtBox.style.left = evt.offsetX + canvasXZ.offsetLeft + "px";
        txtBox.style.top = evt.offsetY + canvasXZ.offsetTop + "px";
        txtBox.focus();

        document.addEventListener('focus', function focusEvent() {
            if (txtBox) {
                txtBox.parentNode.removeChild(txtBox);
                txtBox = null;
                canvasXZ.addEventListener("click", orthoClick);
                createAnnBtn.disabled = false;
            }
        }, true);

        txtBox.addEventListener("keyup", function (e) {
            txtBox.value = txtBox.value.replace(/[-]/g, '');
            if (e.keyCode === 13 && txtBox.value != '') {
                fetch('/saveAnnotation', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        'slice': clipCoords[oClip['xz']],  // 确保你有相应的sliderYZ
                        'plane': 'XZ',
                        'dataset': dsInfo["name"],
                        'moduality': modSelect.value,
                        'exposure': exposureSelect.value,
                        'wavelength': wavelengthSelect.value,
                        'text': txtBox.value,
                        'x': intersects[0].point.x,
                        'y': intersects[0].point.y,
                        'datetime': Date.now()
                    }),
                })
                    .then(response => response.json())
                    .then(data => {
                        let annTxt = data['text'];
                        if (data['instance']) {
                            annTxt += '-' + data['instance'];
                        }
                        drawAnnotation('XZ', annTxt, data['x'], data['y']);  // 确保你有一个drawAnnotationYZ函数

                        var newRow = annTableBody.insertRow();  // 确保你有对应的表格

                        let dt = new Date(data['datetime']);



                        var btn = document.createElement('input');
                        btn.type = "button";
                        btn.className = "btn btn-warning";
                        btn.value = 'Edit';
                        btn.setAttribute('data-toggle', 'modal');
                        btn.setAttribute('data-target', '#annotationModal');
                        btn.setAttribute('data-text', data['text']);
                        btn.setAttribute('data-instance', data['instance'] ? data['instance'] : '0');
                        btn.setAttribute('data-comments', data['comments'] ? data['comments'] : '');

                        newRow.insertCell(0).appendChild(btn);
                        newRow.insertCell(1).appendChild(document.createTextNode(data['text']))
                        newRow.insertCell(2).appendChild(document.createTextNode(data['plane']))
                        newRow.insertCell(3).appendChild(document.createTextNode(data['slice']))
                        newRow.insertCell(4).appendChild(document.createTextNode(data['instance'] ? data['instance'] : '0'))
                        newRow.insertCell(5).appendChild(document.createTextNode(dt.toDateString()))
                        newRow.insertCell(6).appendChild(document.createTextNode(data['user'].split("@")[0]))
                        createAnnBtn.disabled = false;

                        annSlices.push(
                            {
                                "comments": "",
                                "datetime": data['datetime'],
                                "exposure": exposureSelect.value,
                                "instance": data['instance'],
                                "moduality": modSelect.value,
                                "slice": data['slice'],
                                "plane": "XZ",
                                "status": "active",
                                "text": data['text'],
                                "user": data['user'],
                                "wavelength": wavelengthSelect.value,
                                "x": data['x'],
                                "y": data['y']
                            }
                        )
                    })
                    .catch((error) => {
                        console.error('Error:', error);
                    });

                xzDiv.removeChild(txtBox);
                txtBox = null;
                canvasXY.addEventListener("click", orthoClick)
                canvasXZ.addEventListener("click", xzClick)
                canvasYZ.addEventListener("click", yzClick)

                canvasXY.removeEventListener("click", processNewAnn);
                canvasYZ.removeEventListener("click", processNewAnnYZ); // 针对 YZ 平面的处理函数
                createAnnBtn.disabled = false;
            }
        });
    }
}



function loadAnnotationsFast() {
    XYannTextGroup.remove(...XYannTextGroup.children)
    YZannTextGroup.remove(...YZannTextGroup.children)
    XZannTextGroup.remove(...XZannTextGroup.children)
    annTableBody.innerHTML = ``
    let data = annSlices
    for (let i = 0; i < data.length; i++) {
        if (data[i]['slice'] == slider.value && data[i]['status'] != 'hidden' || data[i]['slice'] == clipCoords[oClip['yz']] || data[i]['slice'] == clipCoords[oClip['xz']]) {
            var newRow = annTableBody.insertRow()
            let dt = new Date(data[i]['datetime'])
            var btn = document.createElement('input');
            btn.type = "button";
            btn.className = "btn btn-warning";
            btn.value = 'Edit';
            btn.setAttribute('data-toggle', 'modal')
            btn.setAttribute('data-target', '#annotationModal')
            btn.setAttribute('data-text', data[i]['text'])
            btn.setAttribute('data-plane', data[i]['plane'])
            btn.setAttribute('data-slice', data[i]['slice'])
            btn.setAttribute('data-instance', data[i]['instance'] ? data[i]['instance'] : '0')
            btn.setAttribute('data-comments', data[i]['comments'] ? data[i]['comments'] : '')

            newRow.insertCell(0).appendChild(btn)
            newRow.insertCell(1).appendChild(document.createTextNode(data[i]['text']))
            newRow.insertCell(2).appendChild(document.createTextNode(data[i]['plane']))
            newRow.insertCell(3).appendChild(document.createTextNode(data[i]['slice']))
            newRow.insertCell(4).appendChild(document.createTextNode(data[i]['instance'] ? data[i]['instance'] : '0'))
            newRow.insertCell(5).appendChild(document.createTextNode(dt.toDateString()))
            newRow.insertCell(6).appendChild(document.createTextNode(data[i]['user'].split("@")[0]))
            let annTxt = data[i]['text']
            if (data[i]['instance'])
                annTxt += '-' + data[i]['instance']
            drawAnnotation(data[i]['plane'], annTxt, data[i]['x'], data[i]['y'])
        }
    }
    //hideLoading('xy') Madhu 1/13/21
    createAnnBtn.disabled = false
}

$('#annotationModal').on('show.bs.modal', function (event) {
    let button = $(event.relatedTarget) // Button that triggered the modal
    let Selecttext = button.data('text') // Extract info from data-* attributes
    Selectplane = button.data('plane')
    Selectslice = button.data('slice')
    let Seleteiter = button.data('instance')
    let Selectcomments = button.data('comments')
    // If necessary, you could initiate an AJAX request here (and then do the updating in a callback).
    // Update the modal's content. We'll use jQuery here, but you could use a data binding library or other methods instead.
    let modal = $(this)
    modal.find('#annModalTxt').val(Selecttext)
    modal.find('#annModalOldTxt').val(Selecttext)
    modal.find('#annModalInstance').val(Seleteiter)
    modal.find('#annModalComments').val(Selectcomments)

})

annModalSave.addEventListener('click', () => {

    let i = annSlices.findIndex(
        e => e.text == document.getElementById('annModalOldTxt').value
            && e.instance == document.getElementById('annModalInstance').value
    )



    annSlices[i].text = document.getElementById('annModalTxt').value
    annSlices[i].comments = document.getElementById('annModalComments').value

    loadAnnotationsFast()
    $('#annotationModal').modal('hide')

    fetch('/updateAnnotationComments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'slice': slider.value,
            'dataset': dsInfo["name"],
            'oldText': document.getElementById('annModalOldTxt').value,
            'text': document.getElementById('annModalTxt').value,
            'instance': document.getElementById('annModalInstance').value,
            'comments': document.getElementById('annModalComments').value
        }),
    })
        .then(response => response.json())
        .then(data => {
        })
        .catch((error) => { console.error('Error:', error) })
})


annModalDelete.addEventListener('click', () => {
    let i = annSlices.findIndex(
        e => e.text == document.getElementById('annModalTxt').value
            && e.plane == Selectplane
    )
    annSlices.splice(i, 1)

    $('#annotationModal').modal('hide')
    fetch('/deleteAnnotation', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'slice': Selectslice,
            'plane': Selectplane,
            'dataset': dsInfo["name"],
            'moduality': modSelect.value,
            'exposure': exposureSelect.value,
            'wavelength': wavelengthSelect.value,
            'text': document.getElementById('annModalTxt').value,
            'instance': document.getElementById('annModalInstance').value
        }),
    })
        .then(response => response.json())
        .then(data => { })
        .catch((error) => { console.error('Error:', error) })

    loadAnnotationsFast()
})

function updateCameraAndRendererSizes() {
    if (!cameraXY) return;

    cameraXY.aspect = (xyDiv.offsetWidth / Math.floor(window.innerHeight * 0.25)); // @TODO HARDCODE
    cameraXY.updateProjectionMatrix();
    rendererXY.setSize(xyDiv.offsetWidth, Math.floor(window.innerHeight * 0.25));

    orthos.forEach(ortho => {
        oCameras[ortho].aspect = (originODivWith / Math.floor(window.innerHeight * 0.25));
        oCameras[ortho].updateProjectionMatrix();
        oRenderers[ortho].setSize(originODivWith, Math.floor(window.innerHeight * 0.25));
    });
}

function showLoading(which) {
    document.getElementById(`${which}OverlayDiv`).classList.remove('d-none')
    document.getElementById(`${which}OverlayDiv`).classList.add('d-flex')
}

function hideLoading(which) {
    document.getElementById(`${which}OverlayDiv`).classList.remove('d-flex')
    document.getElementById(`${which}OverlayDiv`).classList.add('d-none')
}

function updateSlice() {
    //showLoading('xy')
    var sasUrl = `https://bivlargefiles.file.core.windows.net/data/${dsInfo['name']}/basis/${modSelect.value}/${exposureSelect.value}/${dsInfo.types[modSelect.value][exposureSelect.value][wavelengthSelect.value]}/xy/${slider.value}.basis?${SAS}`;

    loader.load(sasUrl, function (texture) {
        texture.encoding = THREE.sRGBEncoding
        xyShader.uniforms.u_texture.value = texture
        loadAnnotationsFast()
        clipCoords.z = slider.value
        brushGroup.remove(...brushGroup.children)
        //TODO CALL FUNCTION TO REDRAW MASK IF ACTIVE is this done?
        if (copySliceBox.checked && vertsHolder.length !== 0) {
            let index = vertsHolder.map(e => e.slice).indexOf(String(previousSlice))
            vertsHolder.push({ slice: slider.value, verts: vertsHolder[index].verts })
            // copySliceBox.checked = false
            if (!document.getElementById('minSlice').value || document.getElementById('minSlice').value > slider.value)
                document.getElementById('minSlice').value = slider.value
            if (!document.getElementById('maxSlice').value || document.getElementById('maxSlice').value < slider.value)
                document.getElementById('maxSlice').value = slider.value

            document.getElementById('totalSlices').value = Object.keys(vertsHolder).length
        }
        drawMask()

        previousSlice = slider.value
    }, undefined, function (error) { console.error(error) }
    )

    let points = [];
    points.push(new THREE.Vector3(-dsInfo["imageDims"]["x"] / 2, (slider.max / 2 - slider.value) * dsInfo["voxels"]["z"] * -1, 1));
    points.push(new THREE.Vector3(dsInfo["imageDims"]["x"] / 2, (slider.max / 2 - slider.value) * dsInfo["voxels"]["z"] * -1, 1));

    xzHorzLineGeom.setFromPoints(points)
    xzHorzLine.geometry.attributes.position.needsUpdate = true
    xzHorzLine.geometry.computeBoundingSphere();
    /** MINOR HACK, I couldn't get yz image to flip horizontally so I am changing the direction of the crosshair*/
    points = [];
    points.push(new THREE.Vector3(-(parseInt(dsInfo["imageDims"]["y"]) / 2), (slider.max / 2 - slider.value) * dsInfo["voxels"]["z"] * -1, 1));
    points.push(new THREE.Vector3((parseInt(dsInfo["imageDims"]["y"]) / 2), (slider.max / 2 - slider.value) * dsInfo["voxels"]["z"] * -1, 1));
    yzHorzLineGeom.setFromPoints(points)
    yzHorzLine.geometry.attributes.position.needsUpdate = true
    yzHorzLine.geometry.computeBoundingSphere();
}

saveViewBtn.addEventListener('click', () => {
    const viewInput = document.getElementById('viewName');
    const payload = {
        dataset: dsInfo.name,
        name: viewInput.value,
        x: cameraXY.position.x,
        y: cameraXY.position.y,
        z: cameraXY.position.z,
        moduality: modSelect.value,
        exposure: exposureSelect.value,
        wavelength: wavelengthSelect.value,
        slice: slider.value,
        datetime: Date.now(),
        xxz: oCameras.xz.position.x,
        yxz: oCameras.xz.position.y,
        zxz: oCameras.xz.position.z,
        xyz: oCameras.yz.position.x,
        yyz: oCameras.yz.position.y,
        zyz: oCameras.yz.position.z,
        xClip: clipCoords.x,
        yClip: clipCoords.y,
        threshold: threshold2D.value
    };

    fetch('/saveView', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    })
        .then(response => response.json())
        .then(data => {
            // 在viewsTableBody中添加新行
            const viewsTableBody = document.querySelector('#viewsTable tbody');
            let row = document.createElement('tr');

            // 第一列：View Name
            let nameCell = document.createElement('td');
            nameCell.textContent = data.name;
            row.appendChild(nameCell);

            // 第二列：Buttons
            let buttonCell = document.createElement('td');

            // Load button
            let loadButton = document.createElement('button');
            loadButton.classList.add('btn', 'btn-primary', 'mr-2', 'btn-icon');
            loadButton.innerHTML = '<i class="fas fa-download"></i>';
            loadButton.onclick = function () {
                loadView(data.name);
            };
            buttonCell.appendChild(loadButton);

            // Delete button
            let deleteButton = document.createElement('button');
            deleteButton.classList.add('btn', 'btn-danger', 'mr-2', 'btn-icon');
            deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteButton.onclick = function () {
                deleteView(data.name);
            };
            buttonCell.appendChild(deleteButton);

            // Detail button
            let detailButton = document.createElement('button');
            detailButton.classList.add('btn', 'btn-info', 'btn-icon');
            detailButton.innerHTML = '<i class="fas fa-info-circle"></i>';
            detailButton.onclick = function () {
                viewDetail(data.name);
            };
            buttonCell.appendChild(detailButton);

            row.appendChild(buttonCell);
            viewsTableBody.appendChild(row);

            // 重置viewInput
            viewInput.value = '';
        })
        .catch(error => {
            console.error('Error:', error);
        });
});



/** TODO enhancement being active canvas could be auto selected based off focus*/
fullScreenInput = FullScreenSelect.options[FullScreenSelect.selectedIndex].text

FullScreenSelect.addEventListener('change', () => {
    fullScreenInput = FullScreenSelect.options[FullScreenSelect.selectedIndex].text
})

FullScreenBtn.onclick = () => {
    let element;
    if (fullScreenInput == "XY") {
        cameraXY.aspect = (Math.floor(window.innerWidth) / Math.floor(window.innerHeight)); // @TODO HARDCODE
        cameraXY.updateProjectionMatrix();
        rendererXY.setSize(Math.floor(window.innerWidth), Math.floor(window.innerHeight));
        element = rendererXY.domElement;
    } else if (fullScreenInput == "XZ") {
        oCameras['xz'].aspect = (Math.floor(window.innerWidth) / Math.floor(window.innerHeight));
        oCameras['xz'].updateProjectionMatrix();
        oRenderers['xz'].setSize(Math.floor(window.innerWidth), Math.floor(window.innerHeight));

        element = oRenderers['xz'].domElement;
    } else if (fullScreenInput == "YZ") {
        oCameras['yz'].aspect = (Math.floor(window.innerWidth) / Math.floor(window.innerHeight));
        oCameras['yz'].updateProjectionMatrix();
        oRenderers['yz'].setSize(Math.floor(window.innerWidth), Math.floor(window.innerHeight));

        element = oRenderers['yz'].domElement;
    } else {
        element = document.querySelector('#c');
    }

    if (!document.fullscreenElement) {
        element.requestFullscreen()
            .then(() => {
                // Adjust styles to make sure it covers the entire screen
                element.style.width = '100vw';
                element.style.height = '100vh';
                element.style.display = 'block';
            })
            .catch(err => {
                alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
    } else {
        document.exitFullscreen()
            .catch(err => {
                alert(`Error attempting to exit full-screen mode: ${err.message} (${err.name})`);
            });
    }
};

// Listen for fullscreen change events
document.addEventListener('fullscreenchange', () => {
    let element;
    if (fullScreenInput == "XY") {
        element = rendererXY.domElement;
    } else if (fullScreenInput == "XZ") {
        element = oRenderers['xz'].domElement;
    } else if (fullScreenInput == "YZ") {
        element = oRenderers['yz'].domElement;
    } else {
        element = document.querySelector('#c');
    }

    if (!document.fullscreenElement) {
        // Reset styles after exiting full screen
        element.style.width = '';
        element.style.height = '';
        element.style.display = '';
        updateCameraAndRendererSizes();
    }
});




full3dBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
        let activeCanvas
        if (document.getElementById('orthoTab').classList.contains('active')) {
            alert('The 3D volume rendering scene is not currently active')
            return
        }
        activeCanvas = document.querySelector('#c')
        activeCanvas.requestFullscreen().catch(err => {
            alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`)
        })
    } else {
        document.exitFullscreen()
    }
})


forwardBtn.addEventListener('click', () => {
    let v = parseInt(slider.value)
    if (v == slider.max)
        return
    slider.value = v + 1
    //xyInput.value = v + 1
    //updateSlice()
    slider.dispatchEvent(changeEvent)
})

backBtn.addEventListener('click', () => {
    let v = parseInt(slider.value)
    if (v == slider.min)
        return
    slider.value = v - 1
    //xyInput.value = v - 1
    //updateSlice()
    slider.dispatchEvent(changeEvent)
})

backStepBtn.addEventListener('click', () => {
    slider.value = parseInt(slider.min)
    //xyInput.value = parseInt(slider.min)
    //updateSlice()
    slider.dispatchEvent(changeEvent)
})

forwardStepBtn.addEventListener('click', () => {
    slider.value = parseInt(slider.max)
    //xyInput.value = parseInt(slider.max)
    //updateSlice()
    slider.dispatchEvent(changeEvent)
})

/** Code pen example */

// exportXYZSelect.addEventListener('change', () => {
//      (exportXYZSelect.options[exportXYZSelect.selectedIndex].text)
// })

// exportWidthSelect.addEventListener('change', () => {
//     exportHeightInput.value = Math.round((dsInfo["imageDims"]["y"] / dsInfo["imageDims"]["x"]) * exportWidthSelect.options[exportWidthSelect.selectedIndex].text)
// })
// exportHeightInput = exportSizeSelect.options[exportSizeSelect.selectedIndex].text.split(" ")[2],
//     exportWidthSelect = exportSizeSelect.options[exportSizeSelect.selectedIndex].text.split(" ")[0]

// exportSizeSelect.addEventListener('change', () => {
//     exportHeightInput = exportSizeSelect.options[exportSizeSelect.selectedIndex].text.split(" ")[2]
//     exportWidthSelect = exportSizeSelect.options[exportSizeSelect.selectedIndex].text.split(" ")[0]
//     //  ("exportWidthSelect * exportHeightInput", exportWidthSelect, exportHeightInput)
// })

exportBtn.onclick = () => {
    //  (exportWidthSelect,exportHeightInput)
    takeScreenshot(exportXYZSelect.options[exportXYZSelect.selectedIndex].text)
}

function takeScreenshot(axis) {
    // const screenHeight = window.innerHeight;
    // if (width == 0) {
    //     width = 1024
    //     height = Math.round((dsInfo["imageDims"]["y"] / dsInfo["imageDims"]["x"]) * width)
    // }
    if (axis == "XY") {
        // cameraXY.aspect = width / height;
        // cameraXY.updateProjectionMatrix();
        // rendererXY.setSize(xyDiv.offsetWidth, height);

        rendererXY.render(sceneXY, cameraXY, null, false);
        const dataURL = rendererXY.domElement.toDataURL('image/png');
        saveDataURI(defaultFileName('.png'), dataURL);
        // cameraXY.aspect = (xyDiv.offsetWidth / Math.floor(window.innerHeight * 0.25))
        // cameraXY.updateProjectionMatrix()
        // rendererXY.setSize(xyDiv.offsetWidth, Math.floor(window.innerHeight * 0.25))
    }
    if (axis == "XZ") {
        // oCameras['xz'].aspect = width / height;
        // oCameras['xz'].updateProjectionMatrix();
        // let originWidth = $(oDivs['xz']).width()
        // oRenderers['xz'].setSize(width, height);
        oRenderers['xz'].render(oScenes['xz'], oCameras['xz'], null, false);

        const dataURL = oRenderers['xz'].domElement.toDataURL('image/png');
        saveDataURI(defaultFileName('.png'), dataURL);

        // oCameras['xz'].aspect = (originWidth / Math.floor(window.innerHeight * 0.25))
        // oCameras['xz'].updateProjectionMatrix()
        // oRenderers['xz'].setSize(originWidth, Math.floor(window.innerHeight * 0.25))
    }

    if (axis == "YZ") {
        // oCameras['yz'].aspect = width / height;
        // oCameras['yz'].updateProjectionMatrix();
        // let originWidth = $(oDivs['yz']).width()
        // oRenderers['yz'].setSize(width, height);
        oRenderers['yz'].render(oScenes['yz'], oCameras['yz'], null, false);

        const dataURL = oRenderers['yz'].domElement.toDataURL('image/png');
        saveDataURI(defaultFileName('.png'), dataURL);
        // oCameras['yz'].aspect = (originWidth / Math.floor(window.innerHeight * 0.25))
        // oCameras['yz'].updateProjectionMatrix()
        // oRenderers['yz'].setSize(originWidth, Math.floor(window.innerHeight * 0.25))
    }
}

function dataURIToBlob(dataURI) {
    const binStr = window.atob(dataURI.split(',')[1]);
    const len = binStr.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        arr[i] = binStr.charCodeAt(i);
    }
    return new window.Blob([arr]);
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

function defaultFileName(ext) {
    const str = `${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}${ext}`;
    return str.replace(/\//g, '-').replace(/:/g, '.');
}

var orthos = ['xz', 'yz']
oMaterials = { 'xz': xzMat, 'yz': yzMat }
oGeoms = { 'xz': xzGeom, 'yz': yzGeom }
oMeshes = { 'xz': xzMesh, 'yz': yzMesh }
oClip = { 'xz': 'y', 'yz': 'x' }
oDivs = { 'xz': xzDiv, 'yz': yzDiv }
oCameras = { 'xz': xzCamera, 'yz': yzCamera }
oControls = { 'xz': xzControls, 'yz': yzControls }
oScenes = { 'xz': xzScene, 'yz': yzScene }
oRenderers = { 'xz': xzRenderer, 'yz': yzRenderer }
oAnimate = { 'xz': 0, 'yz': 0 }
oLines = { 'xz': xzLineGroup, 'yz': yzLineGroup }

//object ordering bug if transparent is not set to true
var xLineGeom = new THREE.BufferGeometry()
var xLine = new THREE.Line(xLineGeom, new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true }));
xLine.position.set(0, 0, 1)
var yLineGeom = new THREE.BufferGeometry()
var yLine = new THREE.Line(yLineGeom, new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true }));
yLine.position.set(0, 0, 1)
xzVertLineGeom = new THREE.BufferGeometry()
xzHorzLineGeom = new THREE.BufferGeometry()
yzVertLineGeom = new THREE.BufferGeometry()
yzHorzLineGeom = new THREE.BufferGeometry()

function loadOrthos(fullLoad = true) {
    orthosActive = true
    sceneXY.add(xLine)
    sceneXY.add(yLine)
    initMainOrthoLines()
    /*
    canvasXY.addEventListener("mouseleave", () => {
        //
    })*/
    if (fullLoad) {
        canvasXY.addEventListener("click", orthoClick)
        // canvasYZ.addEventListener("click", orthoClick)
        // canvasXZ.addEventListener("click", orthoClick)
        //clipCoords.x = Math.round(parseInt(dsInfo["imageDims"]["x"]) / 2 / 4 ) * 4
        //clipCoords.y = Math.round(parseInt(dsInfo["imageDims"]["y"]) / 2 / 4 ) * 4
        var points = [];
        points.push(new THREE.Vector3(0, -(parseInt(dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"]) / 2), 1));
        points.push(new THREE.Vector3(0, (parseInt(dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"]) / 2), 1));

        xzVertLineGeom.setFromPoints(points)
        xzVertLine = new THREE.Line(xzVertLineGeom, new THREE.LineBasicMaterial({ color: 0x0000ff, transparent: true }));
        xzVertLine.position.set(0, 0, .1)
        xzVertLine.geometry.attributes.position.needsUpdate = true
        xzVertLine.geometry.computeBoundingSphere();

        points = [];
        points.push(new THREE.Vector3(-(parseInt(dsInfo["imageDims"]["x"]) / 2), 0, 1));
        points.push(new THREE.Vector3((parseInt(dsInfo["imageDims"]["x"]) / 2), 0, 1));
        points.push(new THREE.Vector3(-clipCoords.x, 0, 1));
        points.push(new THREE.Vector3(clipCoords.x, 0, 1));
        xzHorzLineGeom.setFromPoints(points)
        xzHorzLine = new THREE.Line(xzHorzLineGeom, new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true }));
        xzHorzLine.position.set(0, 0, .1)
        xzHorzLine.geometry.attributes.position.needsUpdate = true
        xzHorzLine.geometry.computeBoundingSphere();

        xzLineGroup.add(xzVertLine)
        xzLineGroup.add(xzHorzLine)
        oScenes = { 'xz': new THREE.Scene(), 'yz': new THREE.Scene() }
        oScenes['xz'].add(xzLineGroup)

        points = [];
        points.push(new THREE.Vector3(0, -(parseInt(dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"]) / 2), 1));
        points.push(new THREE.Vector3(0, (parseInt(dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"]) / 2), 1));

        yzVertLineGeom.setFromPoints(points)
        yzVertLine = new THREE.Line(yzVertLineGeom, new THREE.LineBasicMaterial({ color: 0x0000ff, transparent: true }));
        yzVertLine.position.set(0, 0, .1)
        yzVertLine.geometry.attributes.position.needsUpdate = true
        yzVertLine.geometry.computeBoundingSphere();

        points = [];
        points.push(new THREE.Vector3(-(parseInt(dsInfo["imageDims"]["y"]) / 2), 0, 1));
        points.push(new THREE.Vector3((parseInt(dsInfo["imageDims"]["y"]) / 2), 0, 1));

        yzHorzLineGeom.setFromPoints(points)
        yzHorzLine = new THREE.Line(yzHorzLineGeom, new THREE.LineBasicMaterial({ color: 0xff0000, transparent: true }));
        yzHorzLine.position.set(0, 0, .1)
        yzHorzLine.geometry.attributes.position.needsUpdate = true
        yzHorzLine.geometry.computeBoundingSphere();

        yzLineGroup.add(yzVertLine)
        yzLineGroup.add(yzHorzLine)

        oScenes['yz'].add(yzLineGroup)

    }
    showLoading('ortho')
    orthos.forEach(ortho => {
        if (typeof oRenderers[ortho] !== 'object') {

            oRenderers[ortho] = new THREE.WebGLRenderer()
            oRenderers[ortho].setSize($(oDivs[ortho]).width(), Math.floor(window.innerHeight * 0.25))
            oRenderers[ortho].outputEncoding = THREE.sRGBEncoding;
            oDivs[ortho].appendChild(oRenderers[ortho].domElement)
            originODivWith = $(oDivs[ortho]).width()
            oScenes[ortho].remove(oMeshes[ortho])

            oCameras[ortho] = new THREE.PerspectiveCamera(30, $(oDivs[ortho]).width() / Math.floor(window.innerHeight * 0.25), 1, 5000)

            oControls[ortho] = new OrbitControls(oCameras[ortho], oRenderers[ortho].domElement)

            oControls[ortho].target.set(0, 0, 0) // view direction perpendicular to XY-plane
            oControls[ortho].enableRotate = false
            oControls[ortho].zoomToCursor = true
            oControls[ortho].enableZoom = true

            oControls[ortho].addEventListener("change", () => {

                let index = Math.abs(orthos.indexOf(ortho) - 1)
                if (zoomBox.checked) {
                    cameraXY.position.setZ(oCameras[ortho].position.z)
                    oCameras[orthos[index]].position.setZ(oCameras[ortho].position.z)
                }
            })
        }
        oCameras[ortho].position.setZ(cameraXY.position.z)
        let color = pickr2.getColor().toRGBA()
        oScenes[ortho].background = new THREE.Color(`rgb(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])})`)

        oGeoms[ortho] = new THREE.PlaneBufferGeometry(
            dsInfo['dims2'][ortho.charAt(0)],
            dsInfo['dims2'][ortho.charAt(1)] * dsInfo['voxels']['z']
        )
        if (ortho == 'xz') {
            oMaterials[ortho] = xzShader
        } else {
            oMaterials[ortho] = yzShader
        }


        animateOrtho(oRenderers[ortho], oScenes[ortho], oCameras[ortho], oMaterials[ortho], oAnimate[ortho])
        //  ("输出",clipCoords[oClip[ortho]])
        let sasUrl = `https://bivlargefiles.file.core.windows.net/data/${dsInfo['name']}/basis/${modSelect.value}/${exposureSelect.value}/${dsInfo.types[modSelect.value][exposureSelect.value][wavelengthSelect.value]}/${ortho}/${clipCoords[oClip[ortho]]}.basis?${SAS}`;

        loader.load(sasUrl, function (texture) {
            texture.encoding = THREE.sRGBEncoding
            oMaterials[ortho].uniforms.u_texture.value = texture
            oMaterials[ortho].uniforms.u_threshold.value = threshold2D.value / 10
            oMaterials[ortho].uniforms.u_mod.value = '1.0'
            if (modSelect.value == 'Brightfield')
                oMaterials[ortho].uniforms.u_mod.value = '0.0'
            oMaterials[ortho].transparent = true
            oMeshes[ortho] = new THREE.Mesh(oGeoms[ortho], oMaterials[ortho])
            oMeshes[ortho].translateX((dsInfo["dims2"][ortho.charAt(0)] - dsInfo["imageDims"][ortho.charAt(0)]) / 2)
            oMeshes[ortho].translateY((dsInfo["dims2"]["z"] - dsInfo["imageDims"]["z"]) / 2 * dsInfo["voxels"]["z"])
            oScenes[ortho].add(oMeshes[ortho])


            if (ortho == 'yz') {
                hideLoading('ortho')
            }

        }, undefined, function (error) { console.error(error) }
        )
    })

    oScenes['yz'].add(YZannTextGroup)
    oScenes['xz'].add(XZannTextGroup)

    oRenderers['xz'].domElement.addEventListener("click", xzClick)
    oRenderers['yz'].domElement.addEventListener("click", yzClick)

    canvasYZ = oRenderers['yz'].domElement
    canvasYZ.addEventListener("click", yzClick)

    canvasXZ = oRenderers['xz'].domElement
    canvasXZ.addEventListener("click", xzClick)

    controlsXY.addEventListener("change", () => {
        //could add settings flag here
        if (zoomBox.checked)
            orthos.forEach(ortho => {
                oCameras[ortho].position.setZ(cameraXY.position.z)
            })
    })
}

function animateOrtho(rend, scene, camera, mat, animationId) {
    if (!orthosActive) {
        cancelAnimationFrame(animationId)
        return
    }

    animationId = requestAnimationFrame(function () { animateOrtho(rend, scene, camera, mat, animationId) })
    mat.uniforms.u_threshold.value = threshold2D.value / 10
    rend.render(scene, camera)

}

function xzClick(evt) {
    let rect = oRenderers['xz'].domElement.getBoundingClientRect()
    let x = ((evt.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1
    let y = - ((evt.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1
    rayCaster.setFromCamera({ 'x': x, 'y': y }, oCameras['xz'])
    var intersects = []
    mesh.raycast(rayCaster, intersects)
    if (intersects.length > 0) {
        let zLimit = slider.max / 2 * dsInfo['voxels']['z']
        if (intersects[0].point.y > zLimit || intersects[0].point.y < -zLimit)
            return
        let xLimit = dsInfo['imageDims']['x'] / 2
        if (intersects[0].point.x > xLimit || intersects[0].point.x < -xLimit)
            return

        clipCoords.x = Math.round(intersects[0].point.x + (parseInt(dsInfo["imageDims"]["x"]) / 2))
        clipCoords.z = Math.round(intersects[0].point.y / dsInfo['voxels']['z'] + (parseInt(dsInfo["imageDims"]["z"]) / 2))
        // ( clipCoords.z )
        slider.value = clipCoords.z
        //downscaled orthos by 4
        clipCoords.x = Math.round(clipCoords.x / 4) * 4
        //clipCoords.y = Math.round(clipCoords.y/4)*4

        let points = [];
        //xz vert
        points.push(new THREE.Vector3(intersects[0].point.x, -dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"] / 2, 1));
        points.push(new THREE.Vector3(intersects[0].point.x, dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"] / 2, 1));
        xzVertLineGeom.setFromPoints(points)
        xzVertLine.geometry.attributes.position.needsUpdate = true
        xzVertLine.geometry.computeBoundingSphere();

        points = [];
        //xz horz
        points.push(new THREE.Vector3(-dsInfo["imageDims"]["x"] / 2, intersects[0].point.y, 1));
        points.push(new THREE.Vector3(dsInfo["imageDims"]["x"] / 2, intersects[0].point.y, 1));
        xzHorzLineGeom.setFromPoints(points)
        xzHorzLine.geometry.attributes.position.needsUpdate = true
        xzHorzLine.geometry.computeBoundingSphere();

        points = [];
        points.push(new THREE.Vector3(intersects[0].point.x, -dsInfo["imageDims"]["y"] / 2, 1));
        points.push(new THREE.Vector3(intersects[0].point.x, dsInfo["imageDims"]["y"] / 2, 1));

        xLineGeom.setFromPoints(points);
        xLine.geometry.attributes.position.needsUpdate = true
        xLine.geometry.computeBoundingSphere();

        updateOrthoMeshes()

        var event = new Event('change')
        slider.dispatchEvent(event)
        //update meshes
        /**
         * WHAT WE SHOULD REFACTOR THIS TO
         * UPDATE THE CLIPS COORDS IN THIS FUNCTION
         * THEN HAVE A FUNCTION THAT REDRAWS LINES (all)
         * AND THAT LOADS CORRESPONDING MESHES
         */
    }
}

function yzClick(evt) {
    ("点击")
    let rect = oRenderers['yz'].domElement.getBoundingClientRect()
    let x = ((evt.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1
    let y = - ((evt.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1
    rayCaster.setFromCamera({ 'x': x, 'y': y }, oCameras['yz'])
    var intersects = []
    mesh.raycast(rayCaster, intersects)
    if (intersects.length > 0) {
        let limit = slider.max / 2 * dsInfo['voxels']['z']
        if (intersects[0].point.y > limit || intersects[0].point.y < -limit)
            return
        let yLimit = dsInfo['imageDims']['y'] / 2
        if (intersects[0].point.x > yLimit || intersects[0].point.x < -yLimit)
            return
        clipCoords.y = Math.round(intersects[0].point.x + (parseInt(dsInfo["imageDims"]["y"]) / 2))
        clipCoords.z = Math.round(intersects[0].point.y / dsInfo['voxels']['z'] + (parseInt(dsInfo["imageDims"]["z"]) / 2))
        //downscaled orthos by 4
        clipCoords.y = Math.round(clipCoords.y / 4) * 4
        slider.value = clipCoords.z

        let points = [];
        //yz vert
        points.push(new THREE.Vector3(intersects[0].point.x, -dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"] / 2, 1));
        points.push(new THREE.Vector3(intersects[0].point.x, dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"] / 2, 1));
        yzVertLineGeom.setFromPoints(points)
        yzVertLine.geometry.attributes.position.needsUpdate = true
        yzVertLine.geometry.computeBoundingSphere();

        points = [];
        //yz vert
        points.push(new THREE.Vector3(-dsInfo["imageDims"]["y"] / 2, intersects[0].point.y, 1));
        points.push(new THREE.Vector3(dsInfo["imageDims"]["y"] / 2, intersects[0].point.y, 1));
        yzHorzLineGeom.setFromPoints(points)
        yzHorzLine.geometry.attributes.position.needsUpdate = true
        yzHorzLine.geometry.computeBoundingSphere();

        points = [];
        points.push(new THREE.Vector3(-dsInfo["imageDims"]["x"] / 2, intersects[0].point.x, 1));
        points.push(new THREE.Vector3(dsInfo["imageDims"]["x"] / 2, intersects[0].point.x, 1));
        yLineGeom.setFromPoints(points);
        yLine.geometry.attributes.position.needsUpdate = true
        yLine.geometry.computeBoundingSphere();

        updateOrthoMeshes()
        var event = new Event('change')
        slider.dispatchEvent(event)
    }
}

function updateGridLines() {
    //
}

function updateMeshes() {
    //Deprecate this function or just call updateSlice in addition
    updateOrthoMeshes()
}
//update
function orthoClick(evt) {
    ("点击了")
    if (draggedAnn) {
        draggedAnn = false
        return
    }
    let rect = canvasXY.getBoundingClientRect()
    let x = ((evt.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1
    let y = - ((evt.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1
    rayCaster.setFromCamera({ 'x': x, 'y': y }, cameraXY)
    var intersects = []
    mesh.raycast(rayCaster, intersects)
    if (intersects.length > 0) {
        let yLimit = dsInfo['imageDims']['y'] / 2
        if (intersects[0].point.y > yLimit || intersects[0].point.y < -yLimit)
            return
        let xLimit = dsInfo['imageDims']['x'] / 2
        if (intersects[0].point.x > xLimit || intersects[0].point.x < -xLimit)
            return
        clipCoords.x = Math.round(intersects[0].point.x + (parseInt(dsInfo["imageDims"]["x"]) / 2))
        clipCoords.y = Math.round(intersects[0].point.y + (parseInt(dsInfo["imageDims"]["y"]) / 2))
        //downscaled orthos by 4
        clipCoords.x = Math.round(clipCoords.x / 4) * 4
        clipCoords.y = Math.round(clipCoords.y / 4) * 4

        updateOrthoMeshes()
        let points = [];

        points.push(new THREE.Vector3(intersects[0].point.x, -dsInfo["imageDims"]["y"] / 2, 1));
        points.push(new THREE.Vector3(intersects[0].point.x, dsInfo["imageDims"]["y"] / 2, 1));

        xLineGeom.setFromPoints(points);
        xLine.geometry.attributes.position.needsUpdate = true
        xLine.geometry.computeBoundingSphere();
        points = [];
        points.push(new THREE.Vector3(-dsInfo["imageDims"]["x"] / 2, intersects[0].point.y, 1));
        points.push(new THREE.Vector3(dsInfo["imageDims"]["x"] / 2, intersects[0].point.y, 1));
        yLineGeom.setFromPoints(points);
        yLine.geometry.attributes.position.needsUpdate = true
        yLine.geometry.computeBoundingSphere();

        points = [];
        points.push(new THREE.Vector3(intersects[0].point.x, -dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"] / 2, 1));
        points.push(new THREE.Vector3(intersects[0].point.x, dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"] / 2, 1));

        xzVertLineGeom.setFromPoints(points)
        xzVertLine.geometry.attributes.position.needsUpdate = true
        xzVertLine.geometry.computeBoundingSphere();

        points = [];
        points.push(new THREE.Vector3(intersects[0].point.y, -dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"] / 2, 1));
        points.push(new THREE.Vector3(intersects[0].point.y, dsInfo["imageDims"]["z"] * dsInfo["voxels"]["z"] / 2, 1));

        yzVertLineGeom.setFromPoints(points)
        yzVertLine.geometry.attributes.position.needsUpdate = true
        yzVertLine.geometry.computeBoundingSphere();

        canvasXY.onclick = null
    }
}

function initMainOrthoLines() {
    var points = [];
    points.push(new THREE.Vector3(0, -dsInfo["imageDims"]["y"] / 2, 0.5));
    points.push(new THREE.Vector3(0, dsInfo["imageDims"]["y"] / 2, 0.5));

    xLineGeom.setFromPoints(points);
    xLine.geometry.attributes.position.needsUpdate = true
    xLine.geometry.computeBoundingSphere();
    points = [];
    points.push(new THREE.Vector3(-dsInfo["imageDims"]["x"] / 2, 0, 0.5));
    points.push(new THREE.Vector3(dsInfo["imageDims"]["x"] / 2, 0, 0.5));
    yLineGeom.setFromPoints(points);
    yLine.geometry.attributes.position.needsUpdate = true
    yLine.geometry.computeBoundingSphere();
}

function updateOrthoMeshes() {
    //  ("update")
    xclip.value = clipCoords[oClip['yz']]
    yclip.value = clipCoords[oClip['xz']]
        ("xclip,yclip", xclip.value, yclip.value)
    orthos.forEach(ortho => {
        loader.load(`https://bivlargefiles.file.core.windows.net/data/${dsInfo['name']}/basis/${modSelect.value}/${exposureSelect.value}/${dsInfo.types[modSelect.value][exposureSelect.value][wavelengthSelect.value]}/${ortho}/${clipCoords[oClip[ortho]]}.basis?${SAS}`, function (texture) {
            texture.encoding = THREE.sRGBEncoding
            //texture.wrapS = THREE.RepeatWrapping;
            //texture.repeat.x = - 1;
            //texture.flipY = true// should correct this in our preparer
            //oMaterials[ortho].map = texture
            oMaterials[ortho].uniforms.u_texture.value = texture
            oMaterials[ortho].uniforms.u_threshold.value = threshold2D.value / 10
            oMaterials[ortho].needsUpdate = true
            oLines[ortho].visible = true
            if (ortho == 'yz')
                hideLoading('ortho')
        }, undefined, function (error) { console.error(error) }
        )
    })
    loadAnnotationsFast()
}



if (fileManageBtn !== null) {
    fileManageBtn.addEventListener('click', () => {
        //read content directory and set content then show modal
        $('#contentFileManagement').modal('show')
        document.getElementById('contentFileTitle').innerHTML = 'File Management'
    });
}


pickr2 = Pickr.create({
    el: '#bg2',
    theme: 'nano', // or 'monolith', or 'nano'
    default: 'rgba(255, 255, 224, 1)',
    defaultRepresentation: 'RGBA',
    swatches: [
        'rgba(244, 67, 54, 1)',
        'rgba(233, 30, 99, 0.95)',
        'rgba(156, 39, 176, 0.9)',
        'rgba(103, 58, 183, 0.85)',
        'rgba(63, 81, 181, 0.8)',
        'rgba(33, 150, 243, 0.75)',
        'rgba(3, 169, 244, 0.7)',
        'rgba(0, 188, 212, 0.7)',
        'rgba(0, 150, 136, 0.75)',
        'rgba(76, 175, 80, 0.8)',
        'rgba(139, 195, 74, 0.85)',
        'rgba(205, 220, 57, 0.9)',
        'rgba(255, 235, 59, 0.95)',
        'rgba(255, 193, 7, 1)'
    ],

    components: {

        // Main components
        preview: true,
        opacity: false,
        hue: true,

        // Input / output Options
        interaction: {
            clear: true,
            save: true
        }
    }
}).on('save', () => { pickr2.hide() })
    .on('change', (color, instance) => {

        color = color.toRGBA()
        /***Bug fix, since it's not visible on page load it's broken */
        let pickrs = document.getElementsByClassName('pcr-button')
        for (let i = 0; i < pickrs.length; i++)
            pickrs[i].style.color = color.toString()
        sceneXY.background = new THREE.Color(`rgb(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])})`)
        oScenes['xz'].background = new THREE.Color(`rgb(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])})`)
        oScenes['yz'].background = new THREE.Color(`rgb(${Math.round(color[0])},${Math.round(color[1])},${Math.round(color[2])})`)
    })

threshold2D.addEventListener('change', () => {
    var event = new Event('change')

    if (true) { //thresholdBox.checked
        threshold.value = threshold2D.value
        threshold.dispatchEvent(event)
    }

})
/**
threshold.addEventListener('change', ()=> {
    if ( thresholdBox.checked)
        threshold2D.value = threshold.value
}) **/

zclip.addEventListener('input', () => {
    if (zLockBox.checked) {
        if (zclip.value > parseInt(dsInfo["imageDims"]["z"]))
            zclip.value = dsInfo["imageDims"]["z"] - 1

        xyInput.value = zclip.value
        slider.value = zclip.value
        updateSlice()
    }
})

slider.addEventListener("change", () => {
    xyInput.value = slider.value
    if (zLockBox.checked) {
        // zclip.value = slider.value
        zclip.dispatchEvent(keyEvent)
    }
    else {
        zclip.value = slider.value
    }
    updateSlice()
})

xyInput.addEventListener("input", () => {
    clearTimeout(xyInputTimeout)
    // Make a new timeout set to go off in 1000ms (1 second)
    xyInputTimeout = setTimeout(function () {
        if (!xyInput.value)
            return
        if (xyInput.value > parseInt(dsInfo["imageDims"]["z"]))
            xyInput.value = dsInfo["imageDims"]["z"] - 1
        //    xyInput.value = 0
        slider.value = xyInput.value

        //updateSlice()
        slider.dispatchEvent(changeEvent)
    }, 1500)
})

document.getElementById('vrTab').addEventListener('click', () => {
    toggleCards(true);
    orthosActive = false
    //pause execution
    //Handling this now in the ortho animation loop because this failed
    //orthos.forEach(ortho => {
    //oScenes[ortho] = null
    //oDivs[ortho].removeChild(oRenderers[ortho].domElement)
    // ('this is not cancelling')
    //window.cancelAnimationFrame(oAnimate[ortho])
    //})
})


document.getElementById('orthoTab').addEventListener('click', () => {
    if (!orthosActive) {
        loadOrthos(false)
        toggleCards(false)
        loadDynamic2D(dsChanged)
    }
    else
        orthos.forEach(ortho => {
            animateOrtho(oRenderers[ortho], oScenes[ortho], oCameras[ortho], oMaterials[ortho], oAnimate[ortho])
        })
})

fileChooseBtn.onclick = () => {
    fileInput.click();
}

fileInput.addEventListener('change', function () {
    const selectedFile = fileInput.files[0];
    filename.value = selectedFile.name;
});


function loadFiles() {
    fetch('/getFiles', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'dataset': dsInfo["name"]
        }),
    })
        .then(response => response.json())
        .then(data => {
            fileMTableBody.innerHTML = "";
            for (let i = 0; i < data.length; i++) {
                var newRow = fileMTableBody.insertRow();
                newRow.insertCell(0).appendChild(document.createTextNode(data[i]['name']));
                newRow.insertCell(1).appendChild(document.createTextNode(data[i]['format']));

                var buttonGroup = document.createElement("div");

                var filename = data[i]['name'];
                var extension = filename.split('.').pop().toLowerCase();

                // Only add a preview button for supported formats
                if (extension === 'png' || extension === 'jpg' || extension === 'txt' || extension === 'mp4') {
                    var preview_button = document.createElement("button");
                    var preview_icon = document.createElement("i");
                    preview_icon.className = "fas fa-search";
                    preview_button.appendChild(preview_icon);
                    preview_button.classList.add("btn", "btn-primary");
                    preview_button.style.width = '30px';
                    preview_button.style.height = '30px';
                    preview_button.style.padding = '2px';
                    preview_button.style.fontSize = '12px';
                    buttonGroup.appendChild(preview_button);

                    preview_button.onclick = function () {
                        var preview_filename = data[i]['name'];
                        var extension = preview_filename.split('.').pop().toLowerCase();

                        if (extension === 'png' || extension === 'jpg') {
                            fetch('/files/' + encodeURIComponent(preview_filename))
                                .then(response => response.text())
                                .then(text => {

                                    openImagePreviewModal(text, preview_filename);
                                })
                                .catch(error => console.error(error));
                        }
                        else if (extension === 'txt') {
                            fetch('/files/' + encodeURIComponent(preview_filename))
                                .then(response => response.text())
                                .then(text => {
                                    openFilePreviewModal(text, preview_filename);
                                })
                                .catch(error => console.error(error));
                        }
                        else if (extension === 'mp4') {
                            fetch('/files/' + encodeURIComponent(preview_filename))
                                .then(response => response.text())
                                .then(text => {
                                    openVideoPreviewModal(text, preview_filename);
                                })
                                .catch(error => console.error(error));
                        }
                    };
                }

                // Continue adding other buttons
                var download_button = createDownloadButton(data[i]);
                buttonGroup.appendChild(download_button);

                var delete_button = createDeleteButton(data[i]);
                buttonGroup.appendChild(delete_button);

                newRow.insertCell(2).appendChild(buttonGroup);
            }
        });
}

function createDownloadButton(fileData) {
    // 创建下载按钮和图标
    var download_button = document.createElement("button");
    var download_icon = document.createElement("i");
    download_icon.className = "fas fa-download";
    download_button.appendChild(download_icon);

    // 设置按钮的样式
    download_button.classList.add("btn", "btn-primary");
    download_button.style.width = '30px';
    download_button.style.height = '30px';
    download_button.style.padding = '2px';
    download_button.style.fontSize = '12px';

    // 设置按钮的点击事件
    download_button.onclick = function () {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/download');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.responseType = 'blob';

        xhr.onload = function () {
            if (xhr.status === 200) {
                const blob = new Blob([xhr.response], { type: 'application/zip' });
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = 'file_download.zip';  // zip文件名
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(link.href);  // 释放内存
            } else {
                console.error("Failed to download file:", xhr.status, xhr.statusText);
            }
        };

        xhr.onerror = function () {
            console.error("Network error occurred while trying to download file.");
        };

        xhr.send(JSON.stringify({ filename: fileData['name'] }));
    };

    return download_button;
}



function createDeleteButton(fileData) {
    var delete_button = document.createElement("button");
    var delete_icon = document.createElement("i");
    delete_icon.className = "fas fa-trash";
    delete_button.appendChild(delete_icon);
    delete_button.classList.add("btn", "btn-primary");
    delete_button.style.width = '30px';
    delete_button.style.height = '30px';
    delete_button.style.padding = '2px';
    delete_button.style.fontSize = '12px';

    if (session['level'] === "user") {
        delete_button.disabled = true;
    }

    delete_button.onclick = function () {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/delete');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function () {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                if (xhr.status === 200) {
                    alert("File deleted successfully!");
                    loadFiles(); // Reload files
                } else {
                    alert("Error deleting file.");
                }
            }
        };
        xhr.send(JSON.stringify({ filename: fileData['name'] }));
    };

    return delete_button;
}


function openFilePreviewModal(url, fileName) {
    var filePreviewModal = document.getElementById("filePreviewModal");
    var filePreviewContent = document.getElementById("file-preview");
    var filePreviewInfo = document.getElementById("file-info");
    (url)
    var cleanUrl = url.trim().replace(/^"|"$/g, '');
    // Create an iframe element and set its src attribute to the URL of the file
    var iframe = document.createElement('iframe');
    iframe.src = cleanUrl;
    iframe.style.width = '100%';
    iframe.style.height = '300px';
    iframe.style.overflow = 'auto';
    (iframe.src)

    // Clear the preview area and add the newly created iframe element
    filePreviewContent.innerHTML = '';
    filePreviewContent.appendChild(iframe);

    filePreviewInfo.innerText = fileName;
    $(filePreviewModal).modal('show');
}


function openImagePreviewModal(url, filename) {
    var imagePreviewModal = document.getElementById("imagePreviewModal");
    var imagePreviewContent = document.getElementById("image-preview");
    var imagePreviewInfo = document.getElementById("image-info");
    var img = document.createElement('img');

    img.onload = function () {
        img.alt = filename;
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        imagePreviewContent.innerHTML = '';
        imagePreviewContent.appendChild(img);
        imagePreviewInfo.innerText = filename;
        $(imagePreviewModal).modal('show');
    };
    var cleanUrl = url.trim().replace(/^"|"$/g, '');
    img.src = cleanUrl;
}

function openVideoPreviewModal(videoUrl, filename) {
    var videoPreviewModal = document.getElementById("videoPreviewModal");
    var videoPreview = document.getElementById("video-preview");
    var videoInfo = document.getElementById("video-info");

    // Set the src attribute of the <video> element
    (videoUrl)
    var cleanUrl = videoUrl.trim().replace(/^"|"$/g, '');
    videoPreview.src = cleanUrl;
    (cleanUrl)
    // Set the modal title to the file name
    videoInfo.innerText = filename;

    // show modal
    $(videoPreviewModal).modal('show');
}

// After displaying the modal, add this code
$('#videoPreviewModal').on('hidden.bs.modal', function () {
    var videoElement = document.querySelector('#videoPreviewModal video');
    videoElement.pause();
    videoElement.currentTime = 0;
});

UploadFileBtn.addEventListener('click', async function () {
    var file = fileInput.files[0]
    const formData = new FormData();
    formData.append('file', file);
    formData.append('datasetName', dsName)
    const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
    });

    if (response.status >= 200 && response.status < 300) {
        alert('File uploaded successfully');
        loadFiles()
        filename.value = ""
    } else {
        alert('Error uploading file');
    }
});


function toggleCards(showVR) {
    var orthoCard = document.getElementById('xy-card-body');
    var canvasC = document.getElementById('c');
    var DownToolDiv = document.getElementById('DownToolDiv');

    if (showVR) {
        orthoCard.style.display = 'none';  // 隐藏 orthoCard
        DownToolDiv.style.display = 'none'
        canvasC.style.height = (window.innerHeight * 0.6) + 'px';
    } else {
        orthoCard.style.display = 'block';  // 隐藏 orthoCard
        DownToolDiv.style.display = 'block'
        canvasC.style.height = 'none';
    }
}



