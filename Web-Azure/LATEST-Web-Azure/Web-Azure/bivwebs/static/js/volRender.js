var cubeStrip = [
    1, 1, 0,
    0, 1, 0,
    1, 1, 1,
    0, 1, 1,
    0, 0, 1,
    0, 1, 0,
    0, 0, 0,
    1, 1, 0,
    1, 0, 0,
    1, 1, 1,
    1, 0, 1,
    0, 0, 1,
    1, 0, 0,
    0, 0, 0
];

var gl = null;
var canvas = null;

var highlightTrace = null;
var highlightErrors = null;
var showVolume = true;
var volumeThreshold = null;
var saturationThreshold = null;

var loadingProgressText = null;
var loadingProgressBar = null;
var volumeURL = null;

var renderTargets = null;
var depthColorFbo = null
var colorFbo = null;
var blitImageShader = null;

var shader = null;
var volumeTexture = null;
var volumeLoaded = false;
var volumeVao = null;
var volDims = null;
var volValueRange = [0, 1];
var volumeIsInt = 0;

var colormapTex = null;
var fileRegex = /.*\/(\w+)_(\d+)x(\d+)x(\d+)_(\w+)\.*/;
var proj = null;
var camera = null;
var projView = null;
var tabFocused = true;
var newVolumeUpload = true;
var targetFrameTime = 32;
var samplingRate = 1.0;
var WIDTH = 640;
var HEIGHT = 480;

const defaultEye = vec3.set(vec3.create(), 0.5, 0.5, 1.5);
const center = vec3.set(vec3.create(), 0.5, 0.5, 0.5);
const up = vec3.set(vec3.create(), 0.0, 1.0, 0.0);

var volumes = {};

var colormaps = {
    "Grayscale": "./static/colormaps/grayscale.png",
    "Cool Warm": "./static/colormaps/cool-warm-paraview.png",
    "Matplotlib Plasma": "./static/colormaps/matplotlib-plasma.png",
    "Matplotlib Virdis": "./static/colormaps/matplotlib-virdis.png",
    "Rainbow": "./static/colormaps/rainbow.png",
    "Samsel Linear Green": "./static/colormaps/samsel-linear-green.png",
    "Samsel Linear YGB 1211G": "./static/colormaps/samsel-linear-ygb-1211g.png",
};

var renderLoop = function() {
    // Save them some battery if they're not viewing the tab
    if (document.hidden) {
        return;
    }
    if (!volumeLoaded) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        return;
    }

    // Reset the sampling rate and camera for new volumes
    if (newVolumeUpload) {
        camera = new ArcballCamera(defaultEye, center, up, 2, [WIDTH, HEIGHT]);
        samplingRate = 1.0;
        shader.use(gl);
        gl.uniform1f(shader.uniforms["dt_scale"], samplingRate);
    }

    var startTime = performance.now();

    projView = mat4.mul(projView, proj, camera.camera);
    var eye = [camera.invCamera[12], camera.invCamera[13], camera.invCamera[14]];

    var longestAxis = Math.max(volDims[0], Math.max(volDims[1], volDims[2]));
    //console.log(longestAxis)
    //var voxelSpacing = getVoxelSpacing(); will update this to a fetch function corresponding to the right tiff
    var voxelSpacing = [1,1,1.95]
    var volScale = [volDims[0] / longestAxis * voxelSpacing[0],
        volDims[1] / longestAxis * voxelSpacing[1],
        volDims[2] / longestAxis * voxelSpacing[2]];

    gl.bindFramebuffer(gl.FRAMEBUFFER, depthColorFbo);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    gl.bindFramebuffer(gl.FRAMEBUFFER, colorFbo);
    if (volumeLoaded && showVolume) {
        //used
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, renderTargets[1]);
        shader.use(gl);
        gl.uniform2fv(shader.uniforms["value_range"], volValueRange);
        gl.uniform3iv(shader.uniforms["volume_dims"], volDims);
        gl.uniform3fv(shader.uniforms["volume_scale"], volScale);
        gl.uniformMatrix4fv(shader.uniforms["proj_view"], false, projView);
        gl.uniformMatrix4fv(shader.uniforms["inv_proj"], false, invProj);
        gl.uniform1i(shader.uniforms["volume_is_int"], volumeIsInt);

        var invView = mat4.invert(mat4.create(), camera.camera);
        gl.uniformMatrix4fv(shader.uniforms["inv_view"], false, invView);
        gl.uniform3fv(shader.uniforms["eye_pos"], eye);
        gl.uniform1i(shader.uniforms["highlight_trace"], true);
        gl.uniform1f(shader.uniforms["threshold"], volumeThreshold.value);
        gl.uniform1f(shader.uniforms["saturation_threshold"], saturationThreshold.value);

        gl.bindVertexArray(volumeVao);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, cubeStrip.length / 3);
    }

    // Seems like we can't blit the framebuffer b/c the default draw fbo might be
    // using multiple samples?
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    blitImageShader.use(gl);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.BLEND);

    // Wait for rendering to actually finish
    gl.finish();
    var endTime = performance.now();
    var renderTime = endTime - startTime;
    var targetSamplingRate = renderTime / targetFrameTime;

    // If we're dropping frames, decrease the sampling rate, or if we're
    // rendering faster try increasing it to provide better quality
    if (!newVolumeUpload) {
        // Chrome doesn't actually wait for gl.finish to return
        if (targetSamplingRate > 0.8) {
            samplingRate = 0.9 * samplingRate + 0.1 * targetSamplingRate;
            shader.use(gl);
            gl.uniform1f(shader.uniforms["dt_scale"], samplingRate);
        }
    }
    newVolumeUpload = false;
    startTime = endTime;
}

var selectColormap = function() {
    var selection = document.getElementById("colormapList").value;
    var colormapImage = new Image();
    colormapImage.onload = function() {
        gl.activeTexture(gl.TEXTURE1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 180, 1,
            gl.RGBA, gl.UNSIGNED_BYTE, colormapImage);
    };
    colormapImage.src = colormaps[selection];
}

window.onload = function() {
    fillcolormapSelector();
    window.alert = function(message) {console.trace(message)}
    highlightTrace = document.getElementById("highlightTrace");
    highlightErrors = document.getElementById("highlightErrors");

    volumeThreshold = document.getElementById("threshold");
    volumeThreshold.value = 0.1;

    saturationThreshold = document.getElementById("saturationThreshold");
    saturationThreshold.value = 1;

    loadingProgressText = document.getElementById("loadingText");
    loadingProgressBar = document.getElementById("loadingProgressBar");

    canvas = document.getElementById("glcanvas");

    gl = canvas.getContext("webgl2", {antialias: false});
    if (!gl) {
        alert("Unable to initialize WebGL2. Your browser may not support it");
        return;
    }
    WIDTH = canvas.getAttribute("width");
    HEIGHT = canvas.getAttribute("height");

    proj = mat4.perspective(mat4.create(), 60 * Math.PI / 180.0,
        WIDTH / HEIGHT, 0.01, 100);
    invProj = mat4.invert(mat4.create(), proj);

    camera = new ArcballCamera(defaultEye, center, up, 2, [WIDTH, HEIGHT]);
    projView = mat4.create();

    // Register mouse and touch listeners
    var controller = new Controller();
    controller.mousemove = function(prev, cur, evt) {
        if (evt.buttons == 1) {
            camera.rotate(prev, cur);
        } else if (evt.buttons == 2) {
            camera.pan([cur[0] - prev[0], prev[1] - cur[1]]);
        }
    };
    controller.wheel = function(amt) { camera.zoom(amt); };
    controller.pinch = controller.wheel;
    controller.twoFingerDrag = function(drag) { camera.pan(drag); };

    controller.registerForCanvas(canvas);

    // Setup VAO and VBO to render the cube to run the raymarching shader
    volumeVao = gl.createVertexArray();
    gl.bindVertexArray(volumeVao);

    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeStrip), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

    blitImageShader = new Shader(gl, quadVertShader, quadFragShader);
    blitImageShader.use(gl);
    gl.uniform1i(blitImageShader.uniforms["colors"], 3);

    //swcShader = new Shader(gl, swcVertShader, swcFragShader);

    shader = new Shader(gl, vertShader, fragShader);
    shader.use(gl);

    gl.uniform1i(shader.uniforms["volume"], 0);
    gl.uniform1i(shader.uniforms["ivolume"], 5);
    gl.uniform1i(shader.uniforms["colormap"], 1);
    gl.uniform1i(shader.uniforms["depth"], 4);
    gl.uniform1f(shader.uniforms["dt_scale"], 1.0);
    gl.uniform2iv(shader.uniforms["canvas_dims"], [WIDTH, HEIGHT]);

    // Setup required OpenGL state for drawing the back faces and
    // composting with the background color
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.clearColor(0.01, 0.01, 0.01, 1.0);
    gl.clearDepth(1.0);

    // Setup the render targets for the splat rendering pass
    renderTargets = [gl.createTexture(), gl.createTexture()]
    gl.bindTexture(gl.TEXTURE_2D, renderTargets[0]);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, WIDTH, HEIGHT);

    gl.bindTexture(gl.TEXTURE_2D, renderTargets[1]);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, WIDTH, HEIGHT);

    for (var i = 0; i < 2; ++i) {
        gl.bindTexture(gl.TEXTURE_2D, renderTargets[i]);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, renderTargets[0]);
    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, renderTargets[1]);

    depthColorFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, depthColorFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, renderTargets[0], 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
        gl.TEXTURE_2D, renderTargets[1], 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

    colorFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, colorFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D, renderTargets[0], 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);

    // Load the default colormap and upload it, after which we
    // load the default volume.
    var colormapImage = new Image();
    colormapImage.onload = function() {
        var colormap = gl.createTexture();
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, colormap);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.SRGB8_ALPHA8 , 180, 1);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 180, 1,
            gl.RGBA, gl.UNSIGNED_BYTE, colormapImage);

        volumeURL = 'http://localhost:5000/static/BrData/RAW/wholeMouseBrightfield_8bit.tif'
        if (volumeURL) {
            fetchTIFFURL(volumeURL);
        }
        setInterval(renderLoop, targetFrameTime);
    };
    colormapImage.src = colormaps[document.getElementById("colormapList").value];
}

var fillcolormapSelector = function() {
    var selector = document.getElementById("colormapList");
    for (p in colormaps) {
        var opt = document.createElement("option");
        opt.value = p;
        opt.innerHTML = p;
        selector.appendChild(opt);
    }
}

var TIFFGLFormat = function(sampleFormat, bytesPerSample) {
    //return gl.RGBA //let's go
    if (sampleFormat === TiffSampleFormat.UINT
        || sampleFormat == TiffSampleFormat.UNSPECIFIED
        || sampleFormat == TiffSampleFormat.INT)
    {
        if (bytesPerSample == 1) {
            return gl.R8;
        } else if (bytesPerSample == 2) {
            return gl.R16UI
        }
    }
    //Going to swap Tiff.js libs to remove this constraint
    alert("Unsupported TIFF Format, only 8 & 16 bit uint are supported");
}

var makeTIFFGLVolume = function(tiff) {
    
    var imgFormat = TIFFGetField(tiff, TiffTag.SAMPLEFORMAT);
    var bytesPerSample = TIFFGetField(tiff, TiffTag.BITSPERSAMPLE) / 8;
    var width = TIFFGetField(tiff, TiffTag.IMAGEWIDTH);
    var height = TIFFGetField(tiff, TiffTag.IMAGELENGTH);

    var glFormat = TIFFGLFormat(imgFormat, bytesPerSample);
    if (volumeTexture) {
        gl.deleteTexture(volumeTexture);
    }
    //we want to reach gl.RGBA8 AKA gl.RGBA
    if (glFormat == gl.R8) {
        gl.activeTexture(gl.TEXTURE0);
    } else {
        gl.activeTexture(gl.TEXTURE5);
    }
    volumeTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, volumeTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texStorage3D(gl.TEXTURE_3D, 1, glFormat, volDims[0], volDims[1], volDims[2]);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    if (glFormat == gl.R8) {
        volumeIsInt = 0;
        volValueRange[0] = 0;
        volValueRange[1] = 1;
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } else {
        volumeIsInt = 1;
        // R16 is not normalized/texture filterable so we need to normalize it
        volValueRange[0] = Infinity;
        volValueRange[1] = -Infinity;
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
}

var loadTIFFSlice = function(tiff, z_index, slice_scratch) {
    var bps = TIFFGetField(tiff, TiffTag.BITSPERSAMPLE);

    // We only support single channel images
    if (TIFFGetField(tiff, TiffTag.SAMPLESPERPIXEL) != 1) {
        alert("Only RGBA images are supported");
        return;
    }
    
    var imgFormat = TIFFGetField(tiff, TiffTag.SAMPLEFORMAT);

    var width = TIFFGetField(tiff, TiffTag.IMAGEWIDTH);
    var height = TIFFGetField(tiff, TiffTag.IMAGELENGTH);
    //return;
    var numStrips = TIFFNumberOfStrips(tiff);
    var rowsPerStrip = TIFFGetField(tiff, TiffTag.ROWSPERSTRIP);

    var bytesPerSample = TIFFGetField(tiff, TiffTag.BITSPERSAMPLE) / 8;
    
    var sbuf = TIFFMalloc(TIFFStripSize(tiff));
    for (var s = 0; s < numStrips; ++s) {
        var read = TIFFReadEncodedStrip(tiff, s, sbuf, -1);
        if (read == -1) {
            alert("Error reading encoded strip from TIFF file " + file);
        }
        // Just make a view into the heap, not a copy
        //we will need Uint32Array here
        var stripData = new Uint8Array(Module.HEAPU8.buffer, sbuf, read);
        slice_scratch.set(stripData, s * rowsPerStrip * width * bytesPerSample);
    }
    TIFFFree(sbuf);

    // Flip the image in Y, since TIFF y axis is downwards
    /*
    for (var y = 0; y < height / 2; ++y) {
        for (var x = 0; x < width; ++x) {
            for (var b = 0; b < bytesPerSample; ++b) {
                var tmp = slice_scratch[(y * width + x) * bytesPerSample];
                slice_scratch[(y * width + x) * bytesPerSample] =
                    slice_scratch[((height - y - 1) * width + x) * bytesPerSample];
                slice_scratch[((height - y - 1) * width + x) * bytesPerSample] = tmp;
            }
        }
    }*/

    var glFormat = TIFFGLFormat(imgFormat, bytesPerSample);
    if (true) {
        //console.log("hi")
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, volumeTexture);
        gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, z_index,
            width, height, 1, gl.RED, gl.UNSIGNED_BYTE, slice_scratch);
    } else {
        gl.activeTexture(gl.TEXTURE5);
        gl.bindTexture(gl.TEXTURE_3D, volumeTexture);
        var u16arr = new Uint16Array(slice_scratch.buffer);
        for (var j = 0; j < u16arr.length; ++j) {
            volValueRange[0] = Math.min(volValueRange[0], u16arr[j]);
            volValueRange[1] = Math.max(volValueRange[1], u16arr[j]);
        }
        gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, z_index,
            width, height, 1, gl.RED_INTEGER, gl.UNSIGNED_SHORT, u16arr);
    }
}

var loadMultipageTiff = function(tiff, numDirectories) {
    TIFFSetDirectory(tiff, 0);
    var width = TIFFGetField(tiff, TiffTag.IMAGEWIDTH);
    var height = TIFFGetField(tiff, TiffTag.IMAGELENGTH);
    
    var bytesPerSample = TIFFGetField(tiff, TiffTag.BITSPERSAMPLE) / 8;
    
    var slice_scratch = new Uint8Array(width * height * bytesPerSample);
    for (var i = 0; i < numDirectories; ++i) {
        loadTIFFSlice(tiff, i, slice_scratch);
        TIFFReadDirectory(tiff);

        var percent = i / numDirectories * 100;
        loadingProgressBar.setAttribute("style", "width: " + percent.toFixed(2) + "%");
    } 
    // ATTEMPT TO LOAD THE RGBA ONE HERE
    /*
    var xhr = new XMLHttpRequest();
		xhr.responseType = 'arraybuffer';
		xhr.open('GET', "http://localhost:5000/static/BrData/RAW/wholeMouseBrightfield_8_8_4.tif");
		xhr.onload = function (e) {
			Tiff.initialize({TOTAL_MEMORY: 16777216 * 10});
			var tiff = new Tiff({buffer: xhr.response});
			//console.log(gl.getParameter(gl.MAX_TEXTURE_SIZE)) 16384
			for (var i = 0, len = tiff.countDirectory(); i < len; ++i){
                tiff.setDirectory(i); //also z index
                let canvas = tiff.toCanvas()
                if (i % 4)
                    document.body.append(canvas)
                let ab = Uint8Array.from(canvas.getContext("2d").getImageData(0,0,1082,514).data.slice())
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_3D, volumeTexture);
                gl.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, i,
                    width, height, 1, gl.RGBA, gl.UNSIGNED_BYTE,
                    ab)
            }
      			
		};
        xhr.send(); */
        
    volumeLoaded = true;
    newVolumeUpload = true;
    loadingProgressText.innerHTML = "Loaded Volume";
    loadingProgressBar.setAttribute("style", "width: 101%");
}

var fetchTIFFURL = function(url) {
    volumeURL = url;
    volumeLoaded = false;

    var req = new XMLHttpRequest();

    loadingProgressText.innerHTML = "Loading Volume";
    loadingProgressBar.setAttribute("style", "width: 0%");

    req.open("GET", url, true);
    req.responseType = "arraybuffer";
    req.onerror = function(evt) {
        loadingProgressText.innerHTML = "Error Loading Volume: Does your resource support CORS?";
        loadingProgressBar.setAttribute("style", "width: 0%");
        alert("Failed to load volume at " + url + ". Does the resource support CORS?");
    };
    req.onload = function(evt) {
        loadingProgressText.innerHTML = "Fetched Volume";
        loadingProgressBar.setAttribute("style", "width: 50%");
        var dataBuffer = req.response;
        if (req.status == 200 && dataBuffer) {
            FS.createDataFile("/", "remote_fetch.tiff", new Uint8Array(dataBuffer), true, false);
            var tiff = TIFFOpen("remote_fetch.tiff", "r");
            
            var numDirectories = 0;
            if (!TIFFLastDirectory(tiff)) {
                do {
                    ++numDirectories;
                } while (TIFFReadDirectory(tiff));
                TIFFSetDirectory(tiff, 0);
            }

            if (TIFFGetField(tiff, TiffTag.SAMPLESPERPIXEL) != 1) {
                alert("Only single channel images are supported || Field read correctly");
            } else {
                var width = TIFFGetField(tiff, TiffTag.IMAGEWIDTH);
                var height = TIFFGetField(tiff, TiffTag.IMAGELENGTH);
                volDims = [width, height, numDirectories];
                document.getElementById("volumeName").innerHTML =
                    "Volume: Multi-page '" + volumeURL + "', " + numDirectories + " pages";
                
                makeTIFFGLVolume(tiff);

                loadMultipageTiff(tiff, numDirectories);
            }
            TIFFClose(tiff);
            FS.unlink("/remote_fetch.tiff");
        } else {
            alert("Unable to load TIFF from remote URL");
        }
    };
    req.send();
}