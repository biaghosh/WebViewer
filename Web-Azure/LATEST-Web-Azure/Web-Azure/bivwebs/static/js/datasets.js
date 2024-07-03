let selectedDatasetName = "";
let institutionsList = [];
let shouldContinue = true;
let currentSelectedInstitutionName = null;

window.addEventListener("DOMContentLoaded", function () {
    getInstitutions().then(institutions => {
        institutionsList = institutions;
        populateFilter();
    });

    getDatasets().then(datasets => {
        renderDatasetList(datasets);
    });
});

function renderDatasetList(datasets) {
    const tbody = document.getElementById('datasetTableBody');
    tbody.innerHTML = ''; 

    datasets.forEach(dataset => {
        const row = document.createElement('tr');
        row.dataset.name = dataset.name;
        row.style.cursor = "pointer";

        const institutionCell = document.createElement('td');
        institutionCell.style.width = "40%";
        institutionCell.textContent = dataset.institution;

        const nameCell = document.createElement('td');
        nameCell.textContent = dataset.name;
        nameCell.style.width = "30%";

        const poNumCell = document.createElement('td');
        poNumCell.textContent = dataset.ponum;
        poNumCell.style.width = "30%";

        row.appendChild(institutionCell);
        row.appendChild(nameCell);
        row.appendChild(poNumCell);
        tbody.appendChild(row);
    });

    tbody.addEventListener('click', (event) => {
        const selectedRow = event.target.closest('tr');
        if (selectedRow) {
            selectedDatasetName = selectedRow.dataset.name;
            const allRows = document.querySelectorAll('#datasetList tr');
            allRows.forEach(row => row.classList.remove('selected-dataset'));
            selectedRow.classList.add('selected-dataset');
            fetch('/getDatasetsData', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 'datasetName': selectedDatasetName }),
            })
                .then(response => response.json())
                .then(data => {
                    updateDatasetList(data);
                })
                .catch(error => console.error('Error:', error));
        }
    });

    if (datasets.length > 0) {
        const firstRow = tbody.querySelector('tr');
        firstRow.click();
    }
}

document.getElementById("downloadDatasetBtn").addEventListener("click", function () {
    if (selectedDatasetName) {
        fetch('/downloadDataset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 'datasetName': selectedDatasetName }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.download_urls && Array.isArray(data.download_urls)) {
                    if (data.download_urls.length === 0) {
                        alert("No files found for the selected dataset.");
                        return;
                    }
                    data.download_urls.forEach(url => {
                        window.open(url, '_blank');
                    });
                } else {
                    console.error("Received unexpected data format from server:", data);
                }
            })
            .catch(error => console.error('Error:', error));
    } else {
        alert("Please select a dataset first!");
    }
});

document.getElementById("deleteDatasetBtn").addEventListener("click", function () {
    if (selectedDatasetName) {
        const isConfirmed = confirm("Are you sure you want to delete this dataset? This action cannot be undone.");
        if (isConfirmed) {
            fetch('/deleteDataset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 'datasetName': selectedDatasetName }),
            })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        window.location.reload();
                    } else {
                        alert(data.message);
                    }
                })
                .catch(error => console.error('Error:', error));
        }
    } else {
        alert("Please select a dataset first!");
    }
});

function updateDatasetList(datasets) {
    const dataset = datasets[0];

    document.getElementById('datasetName').value = dataset.name;
    document.getElementById('voxelsX').value = dataset.voxels.x;
    document.getElementById('voxelsY').value = dataset.voxels.y;
    document.getElementById('voxelsZ').value = dataset.voxels.z;
    document.getElementById('dims3X').value = dataset.dims3.x;
    document.getElementById('dims3Y').value = dataset.dims3.y;
    document.getElementById('dims3Z').value = dataset.dims3.z;
    document.getElementById('dims2X').value = dataset.dims2.x;
    document.getElementById('dims2Y').value = dataset.dims2.y;
    document.getElementById('dims2Z').value = dataset.dims2.z;
    document.getElementById('imageDimsX').value = dataset.imageDims.x;
    document.getElementById('imageDimsY').value = dataset.imageDims.y;
    document.getElementById('imageDimsZ').value = dataset.imageDims.z;
    document.getElementById('infoVoxels').value = dataset.info.voxels;
    document.getElementById('infoThickness').value = dataset.info.thickness;
    document.getElementById('pixelLengthUM').value = dataset.pixelLengthUM;
    document.getElementById('zSkip').value = dataset.zskip;
    document.getElementById('infoSpecimen').value = dataset.info.specimen;
    document.getElementById('infoPI').value = dataset.info.PI;

    let institutionSelectHTML = '';
    institutionsList.forEach(institution => {
        const isSelected = dataset.institution === institution.name ? ' selected' : '';
        institutionSelectHTML += `<option value="${institution.name}"${isSelected}>${institution.name}</option>`;
    });
    document.getElementById('institutionSelect').innerHTML = institutionSelectHTML;

    // populatePoNumberSelect is only called when updating dataset information
    if (dataset.ponum) {
        populatePoNumberSelect(dataset.institution, dataset.ponum);
    }

    const form = document.querySelector('.dataset-info-form');
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const formData = new FormData(form);
        const updateData = Object.fromEntries(formData.entries());
        const selectedPoNumber = document.getElementById('poNumberSelect').value;
        updateData.ponum = selectedPoNumber;
        fetch('/updateDataset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData),
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert('Dataset updated successfully!');
                } else {
                    alert('Failed to update dataset.');
                }
            })
            .catch(error => console.error('Error:', error));
    });
}

document.getElementById('updateDatasetBtn').addEventListener('click', function () {
    document.querySelector('.dataset-info-form').dispatchEvent(new Event('submit'));
    window.location.reload();
});

function populateFilter() {
    const filter = document.getElementById('institutionFilter');
    institutionsList.forEach(institution => {
        const option = document.createElement('option');
        option.value = institution.name;
        option.textContent = institution.name;
        filter.appendChild(option);
    });
}

function filterDatasets(institution) {
    getDatasets().then(datasets => {
        const filteredDatasets = institution === 'all' ? datasets : datasets.filter(dataset => dataset.institution === institution);
        renderDatasetList(filteredDatasets);
    });
}

document.getElementById('institutionFilter').addEventListener('change', (e) => {
    filterDatasets(e.target.value);
});

function getDatasets() {
    return fetch('getDatasets')
        .then(response => response.json())
        .then(datasets => {
            return datasets;
        })
        .catch(error => {
            console.error('Error:', error);
            return [];
        });
}

function getInstitutions() {
    return fetch('/getInstitutions')
        .then(response => response.json())
        .then(institutions => {
            return institutions;
        })
        .catch(error => {
            console.error('Error:', error);
            return [];
        });
}

document.getElementById('submitBtn').addEventListener('click', async function () {
    console.log(institutionsList)
    const fileInputTiff = document.getElementById('fileInputTiff');
    if (!fileInputTiff.files.length) {
        alert('Please upload the .tif file');
        return;
    }
    const fileTiff = fileInputTiff.files[0];
    const filename = fileInputTiff.files[0].name.split('.')[0]
    const abbr = filename.split('#')[0]
    if (!institutionsList.find(institution => institution.abbr === abbr)) {
        alert('Abbr(Institution) does not exist');
        return;
    }

    const institutionName = institutionsList.find(institution => institution.abbr === abbr).name;
    const datasetName = filename.split('#')[1]
    const Modality = filename.split('#')[2]
    const Exposure = filename.split('#')[3]
    const Wavelength = filename.split('#')[4]
    const formData = new FormData();
    formData.append('abbr', abbr);
    formData.append('institutionName', institutionName);
    formData.append('dataset-name', datasetName);
    formData.append('modality', Modality);
    formData.append('exposure', Exposure);
    formData.append('wavelength', Wavelength);
    formData.append('FileName', fileTiff.name);
    formData.append('fileContent', fileTiff);

    var fileExtension = fileInputTiff.files[0].name.split('.').pop().toLowerCase();
    const institutionExists = institutionsList.find(institution => institution.abbr === abbr);

    if (!institutionExists) {
        alert('Institution name does not exist in the list.');
        return;
    }

    if (fileExtension !== 'tif') {
        alert('Wrong file format! Please upload the .tif file');
        return;
    }

    getProgress();

    const response = await fetch('/UploadDataset', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        console.error('Upload failed:', response.statusText);
    } else {
        shouldContinue = false
        const data = await response.json();
        alert(data.message)
        submitBtn.disabled = false;
        window.location.reload();
    }
});

function getProgress() {
    if (!shouldContinue) {
        console.log("Exiting getProgress because shouldContinue is false");
        return;
    }

    fetch('/progress')
        .then(response => {
            if (!response.ok) {
                console.error('Response not OK:', response);
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            const progress = data.progress;
            const progress_per = progress * 100;
            console.log(progress, progress_per);
            document.getElementById('progress-bar-fill').style.width = progress_per + '%';
            document.getElementById('progress-bar-fill').textContent = Math.round(progress_per) + '%';

            if (shouldContinue) {
                setTimeout(getProgress, 1000);
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
        });
}


function populatePoNumberSelect(institutionName, currentPoNumber) {
    const poNumberSelect = document.getElementById('poNumberSelect');
    poNumberSelect.innerHTML = '';
    fetch(`/getOrdersByInstitution/${institutionName}`)
        .then(response => response.json())
        .then(orders => {
            orders.forEach(order => {
                const option = document.createElement('option');
                option.value = order.PO_number;
                option.textContent = order.PO_number;
                poNumberSelect.appendChild(option);
            });
            poNumberSelect.value = currentPoNumber;
        })
        .catch(error => console.error('Error:', error));
}

function deleteWavelength(type, exposure, wavelength) {
    fetch('/delete-wavelength', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            datasetName: selectedDatasetName,
            type,
            exposure,
            wavelength
        })
    })
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
        })
        .catch((error) => {
            console.error('Error:', error);
        });

    console.log(`Request sent to delete wavelength: ${wavelength} from type: ${type}, exposure: ${exposure}, for dataset: ${selectedDatasetName}`);
}


