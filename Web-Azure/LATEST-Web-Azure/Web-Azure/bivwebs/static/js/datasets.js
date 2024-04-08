let selectedDatasetName = ""
let institutionsList = [];
window.addEventListener("DOMContentLoaded", function () {
    getDatasets().then(datasets => {
        // Populate filter options
        populateFilter(datasets);

        // Initial rendering form
        renderDatasetList(datasets);

    });
});

window.generateAndInsertOrder = generateAndInsertOrder;
window.showOrderDetails = showOrderDetails;
window.submitInstitutionForm = submitInstitutionForm;
window.deleteInstitution = deleteInstitution;
window.deleteWavelength = deleteWavelength;


function renderDatasetList(datasets) {
    const datasetList = document.getElementById('datasetList');
    datasetList.innerHTML = ''; // Clear existing content

    // Create table structure
    const table = document.createElement('table');
    table.classList.add('list-group');

    // Create and add headers
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const institutionHeader = document.createElement('th');
    institutionHeader.textContent = 'Institution';

    const poNumHeader = document.createElement('th');
    poNumHeader.textContent = 'PO_#';

    const nameHeader = document.createElement('th');
    nameHeader.textContent = 'Name';

    headerRow.appendChild(institutionHeader);
    headerRow.appendChild(nameHeader);
    headerRow.appendChild(poNumHeader);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create and populate the table body
    const tbody = document.createElement('tbody');
    datasets.forEach(dataset => {
        const row = document.createElement('tr');
        row.dataset.name = dataset.name; // It is convenient to obtain the selected data set name later.
        row.style.cursor = "pointer"; // Make rows appear clickable

        const institutionCell = document.createElement('td');
        institutionCell.textContent = dataset.institution;

        const nameCell = document.createElement('td');
        nameCell.textContent = dataset.name;

        const poNumCell = document.createElement('td');
        poNumCell.textContent = dataset.ponum;

        row.appendChild(institutionCell);
        row.appendChild(nameCell);
        row.appendChild(poNumCell);

        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    datasetList.appendChild(table);

    tbody.addEventListener('click', (event) => {
        const selectedRow = event.target.closest('tr');
        if (selectedRow) {
            selectedDatasetName = selectedRow.dataset.name;

            // Remove the selected-dataset class of previously selected rows
            const allRows = document.querySelectorAll('#datasetList tr');
            allRows.forEach((row) => {
                row.classList.remove('selected-dataset');
            });

            // Add the selected-dataset class to the currently selected row
            selectedRow.classList.add('selected-dataset');

            // Get selected data set information
            fetch('/getDatasetsData', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'datasetName': selectedDatasetName,
                }),
            })
                .then(response => response.json())
                .then(data => {
                    // Updates to dataset details are handled here
                    updateDatasetList(data);
                    // Populate the PO# dropdown based on the organization of the dataset
                    populatePoNumberSelect(data[0].institution, data[0].ponum);
                })
                .catch((error) => {
                    console.error('Error:', error)
                });
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
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                'datasetName': selectedDatasetName,
            }),
        })
            .then(response => response.json())
            .then(data => {
                // Check if we get the URL list
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

// Listen to the delete button 
document.getElementById("deleteDatasetBtn").addEventListener("click", function () {
    if (selectedDatasetName) {
        const isConfirmed = confirm("Are you sure you want to delete this dataset? This action cannot be undone.");
        if (isConfirmed) {
            fetch('/deleteDataset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    'datasetName': selectedDatasetName,
                }),
            })
                .then(response => response.json())
                .then(data => {
                    if (data.status === 'success') {
                        renderDatasetList();
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
    const dataset = datasets[0]
    console.log(dataset)
    const datasetInfoDiv = document.getElementById('datasetInfo');
    datasetInfoDiv.innerHTML = ''; // Clear existing content

    let institutionSelectHTML = '<select class="form-control" name="institution">';
    // console.log(institutionsList)
    institutionsList.forEach(institution => {
        const isSelected = dataset.institution === institution.name ? ' selected' : '';
        institutionSelectHTML += `<option value="${institution.name}"${isSelected}>${institution.name}</option>`;
    });

    institutionSelectHTML += '</select>';

    const form = document.createElement('form');
    form.className = 'dataset-info-form';
    let formHTML = `
        <div class="xyz-container">
            <div class="flex-item title">Name:</div>
            <div class="flex-item"><input type="text" class="form-control" name="name" value="${dataset.name}" /></div>
            <div class="flex-item title">Institution:</div>
            <div class="flex-item institution">${institutionSelectHTML}</div>
            <div class="flex-item title">PO#:</div>
            <div class="flex-item ponum"><select id="poNumberSelect" class="form-control">
        <!-- Options will be added dynamically via JavaScript -->
        </select></div>
        </div>`;

    // 假设 dataset.types 已经被定义
    if (dataset.types) {
        let typesContent = '<div class="types-row">';

        Object.keys(dataset.types).forEach((type, index) => {
            // 对每种类型使用 flex-item 容器
            typesContent += `<div class="flex-item"><div class="type-name">{ ${type} }</div><div class="exposures">`;

            Object.keys(dataset.types[type]).forEach(exposure => {
                typesContent += `<div>[ Exposure ${exposure}:`;
                const wavelengths = dataset.types[type][exposure];
                wavelengths.forEach(wavelength => {
                    typesContent += `<span class="wavelength"> (Wavelength: ${wavelength} <span class="delete-button" onclick="deleteWavelength('${type}', '${exposure}', '${wavelength}')">&#x2715;</span>)</span>`;
                });
                typesContent += ` ]</div>`;
            });

            typesContent += '</div></div>';

            // 每两个类型创建一个新行
            if ((index + 1) % 2 === 0) typesContent += '</div><div class="types-row">';
        });

        typesContent += '</div>'; // 结束最后一行
        datasetInfoDiv.innerHTML = typesContent;
    } else {
        datasetInfoDiv.innerHTML = '<p>No types information available.</p>';
    }


    formHTML += `
        <div class="xyz-container">
            <div class="flex-item title">Voxels:</div>
            <div class="flex-item">X: <input type="number" class="form-control" name="voxels[x]" value="${dataset.voxels.x}" /></div>
            <div class="flex-item">Y: <input type="number" class="form-control" name="voxels[y]" value="${dataset.voxels.y}" /></div>
            <div class="flex-item">Z: <input type="number" class="form-control" name="voxels[z]" value="${dataset.voxels.z}" /></div>
        </div>

        <div class="xyz-container">
            <div class="flex-item title">Dims3:</div>
            <div class="flex-item">X: <input type="number" class="form-control" name="dims3[x]" value="${dataset.dims3.x}" /></div>
            <div class="flex-item">Y: <input type="number" class="form-control" name="dims3[y]" value="${dataset.dims3.y}" /></div>
            <div class="flex-item">Z: <input type="number" class="form-control" name="dims3[z]" value="${dataset.dims3.z}" /></div>
        </div>

        <div class="xyz-container">
            <div class="flex-item title">Dims2:</div>
            <div class="flex-item">X: <input type="number" class="form-control" name="dims2[x]" value="${dataset.dims2.x}" /></div>
            <div class="flex-item">Y: <input type="number" class="form-control" name="dims2[y]" value="${dataset.dims2.y}" /></div>
            <div class="flex-item">Z: <input type="number" class="form-control" name="dims2[z]" value="${dataset.dims2.z}" /></div>
        </div>
        
        <div class="xyz-container">
            <div class="flex-item title">Image Dims:</div>
            <div class="flex-item">X: <input type="number" class="form-control" name="imageDims[x]" value="${dataset.imageDims.x}" /></div>
            <div class="flex-item">Y: <input type="number" class="form-control" name="imageDims[y]" value="${dataset.imageDims.y}" /></div>
            <div class="flex-item">Z: <input type="number" class="form-control" name="imageDims[z]" value="${dataset.imageDims.z}" /></div>
        </div>  

        <div class="xyz-container">
            <div class="flex-item title">Info:</div>
            <div class="flex-item">Voxels: <input type="text" class="form-control" name="info[voxels]" value="${dataset.info.voxels}" /></div>
            <div class="flex-item">Thickness: <input type="text" class="form-control" name="info[thickness]" value="${dataset.info.thickness}" /></div>
            <div class="flex-item">Pixel Length UM: <input type="text" class="form-control" name="pixelLengthUM" value="${dataset.pixelLengthUM}" /></div>
            <div class="flex-item">Z Skip: <input type="number" class="form-control" name="zskip" value="${dataset.zskip}" /></div>
        </div> 

        <div class="xyz-container">
            <div class="mb-2">Specimen: <input type="text" class="form-control" name="info[specimen]" value="${dataset.info.specimen}" /></div>
            <div class="mb-2">PI: <input type="text" class="form-control" name="info[PI]" value="${dataset.info.PI}" /></div>
        </div> 
    `;

    form.innerHTML = formHTML;
    datasetInfoDiv.appendChild(form);
    // const form = document.querySelector('.dataset-info-form');
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const formData = new FormData(form);
        const updateData = Object.fromEntries(formData.entries());
        const selectedPoNumber = document.getElementById('poNumberSelect').value;
        updateData.ponum = selectedPoNumber;
        // Send update request
        fetch('/updateDataset', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(updateData),
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert('Dataset updated successfully!');
                    // The dataset list may need to be reloaded or updated
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

function populateFilter(datasets) {
    const institutionSet = new Set(datasets.map(dataset => dataset.institution));
    const filter = document.getElementById('institutionFilter');
    institutionSet.forEach(institution => {
        const option = document.createElement('option');
        option.value = institution;
        option.textContent = institution;
        filter.appendChild(option);
    });
}

function filterDatasets(institution) {
    // Assume that getDatasets() returns a Promise for all data sets
    getDatasets().then(datasets => {
        // Filter the dataset based on the selected institution
        const filteredDatasets = institution === 'all' ? datasets : datasets.filter(dataset => dataset.institution === institution);
        // Re-render the table
        renderDatasetList(filteredDatasets);
    });
}

document.getElementById('institutionFilter').addEventListener('change', (e) => {
    // Pass the selected institution name to the filterDatasets function
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

function renderInstitutionList(institutions) {
    const institutionList = document.getElementById('institutionList');
    institutionList.innerHTML = ''; // Clear existing content

    institutions.forEach((institution, index) => {
        const item = document.createElement('div');
        item.className = 'list-group-item list-group-item-action';
        item.textContent = institution.name;
        item.onclick = () => {
            // Remove 'selected' class from all items
            document.querySelectorAll('#institutionList .list-group-item').forEach(el => {
                el.classList.remove('selected');
            });
            // Add 'selected' class to clicked item
            item.classList.add('selected');
            showInstitutionDetails(institution);
        };
        institutionList.appendChild(item);

        // Automatically select and show details for the first institution
        if (index === 0) {
            item.classList.add('selected');
            showInstitutionDetails(institution);
        }
    });

}

function showInstitutionDetails(institution) {
    const institutionDetails = document.getElementById('institutionDetails');

    // Assume the type and status options
    const typeOptions = ['Industry', 'Academic', 'Government', 'Others'];
    const statusOptions = ['Active', 'Inactive', 'Pending'];

    // Create drop down options
    const typeSelectHTML = typeOptions.map(option => `<option value="${option}" ${institution.type === option ? 'selected' : ''}>${option}</option>`).join('');
    const statusSelectHTML = statusOptions.map(option => `<option value="${option}" ${institution.status === option ? 'selected' : ''}>${option}</option>`).join('');

    // Generate showing PO-Number order list with two columns
    const ordersHeader = `
    <div class="list-group-item header">
        <div class="order-info-header">
            <span class="po-number-header">PO Number</span>
            <span class="order-date-header">Order Date</span>
        </div>
    </div>
`;

    const ordersHTML = institution.orders.map(order => `
    <div class="list-group-item list-group-item-action" onclick="showOrderDetails('${institution.name}', '${order.PO_number}')">
        <div class="order-info">
            <span class="po-number">${order.PO_number}</span>
            <span class="order-date">${order.date}</span>
        </div>
    </div>
`).join('');


    // Combine header and list items
    const ordersListHTML = ordersHeader + ordersHTML;

    // Set the details HTML
    institutionDetails.innerHTML = `
        <form id="institutionForm">
            <div class="xyz-container">
                <div class="flex-item title">Name:</div>
                <div class="flex-item"><input type="text" class="form-control" name="name" value="${institution.name}"></div>

                <div class="flex-item title">Type:</div>
                <div class="flex-item"><select class="form-control" name="type">
                    ${typeSelectHTML}
                </select></div>
            </div>  

            <div class="xyz-container">
                <div class="flex-item title">Phone Number:</div>
                <div class="flex-item"><input type="text" class="form-control" name="phone" value="${institution.phone}"></div>

                <div class="flex-item title">Email:</div>
                <div class="flex-item"><input type="text" class="form-control" name="Email" value="${institution.Email}"></div>
            </div>

            <div class="form-group">
                <div class="flex-item title">Address:</div>
                <input type="text" class="form-control" name="address" value="${institution.address}">
            </div>

            <div class="form-group">
                <div class="flex-item title">Website:</div>
                <input type="text" class="form-control" name="website" value="${institution.website}">
            </div>

            <div class="form-group">
                <div class="flex-item title">Status:</div>
                <select class="form-control" name="status">
                    ${statusSelectHTML}
                </select>
            </div>

            <div class="form-group">
                <div class="flex-item title">Orders:</div>
                <div class="orders-container">
                    <div class="orders list-group">
                        ${ordersListHTML}
                    </div>
                    <div id="orderDetails" class="order-details"></div>
                </div>
            </div>

            <div class="form-group">
                <div class="flex-row-container" style="display: flex; align-items: center; justify-content: space-between;">
                    <div class="flex-item" style="flex-grow: 1; margin-right: 10px;"><input type="text" class="form-control" placeholder="Enter PO Number" id="newPoNumber"></div>
                    <div class="flex-item"><button class="btn btn-sm btn-primary" onclick="generateAndInsertOrder('${institution.name}')">Generate Order</button></div>
                </div>
            </div>

            
            <button type="submit" class="btn btn-sm btn-primary btn-icon-only">Update</button>
            <button type="button" class="btn btn-sm btn-danger ml-2 btn-icon-only" onclick="deleteInstitution()"><i class="fas fa-trash"></i></button>
        </form>
    `;

    // Add form submit event listener
    document.getElementById('institutionForm').addEventListener('submit', function (e) {
        e.preventDefault();
        updateInstitutionDetails(); // Implement this function to handle form submission
    });
}

function updateInstitutionDetails() {
    const form = document.getElementById('institutionForm');
    const formData = new FormData(form);
    const updatedDetails = {};
    formData.forEach((value, key) => {
        updatedDetails[key] = value;
    });

    fetch('/updateInstitution', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedDetails),
    })
        .then(response => response.json())
        .then(data => {
            window.location.reload();
        })
        .catch((error) => {
            console.error('Error:', error);
            // Handle error conditions
        });
}

document.getElementById('newInstitutionBtn').addEventListener('click', function () {
    const institutionDetails = document.getElementById('institutionDetails');
    const typeOptions = ['Industry', 'Academic', 'Government', 'Others'];
    const statusOptions = ['Active', 'Inactive', 'Pending'];
    const statusSelectHTML = statusOptions.map(option => `<option value="${option}">${option}</option>`).join('');
    const typeSelectHTML = typeOptions.map(option => `<option value="${option}"}>${option}</option>`).join('');

    // Clear the details area and provide a blank form
    institutionDetails.innerHTML = `
        <form id="institutionForm">
            <div class="form-group">
                <label>Name:</label>
                <input type="text" class="form-control" name="name" value="">
            </div>

            <div class="form-group">
                <label>Type:</label>
                <select class="form-control" name="type">
                    ${typeSelectHTML}
                </select>
            </div>

            <div class="form-group">
                <label>Address:</label>
                <input type="text" class="form-control" name="address" value="">
            </div>

            <div class="form-group">
                <label>Phone Number:</label>
                <input type="text" class="form-control" name="phone" value="">
            </div>

            <div class="form-group">
                <label>Email:</label>
                <input type="text" class="form-control" name="Email" value="">
            </div>

            <div class="form-group">
                <label>Website:</label>
                <input type="text" class="form-control" name="website" value="">
            </div>
            <div class="form-group">
                <label>Status:</label>
                <select class="form-control" name="status">
                    ${statusSelectHTML}
                </select>
            </div>
            <button type="button" class="btn btn-sm btn-primary btn-icon-only" onclick="submitInstitutionForm()">Update</button>
        </form>
    `;
});

function deleteInstitution() {
    const institutionName = document.querySelector('#institutionForm [name="name"]').value;
    if (confirm(`Are you sure you want to delete the institution "${institutionName}"?`)) {
        fetch('/deleteInstitution', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: institutionName }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    alert('Institution deleted successfully!');
                    window.location.reload(); // Refresh the page to update the list of institutions
                } else {
                    alert('Failed to delete institution.');
                }
            })
            .catch(error => console.error('Error:', error));
    }
}

// Modify the submitInstitutionForm function to distinguish between update and new creation
function submitInstitutionForm() {
    const form = document.getElementById('institutionForm');
    const formData = new FormData(form);
    let institutionData = {};
    formData.forEach((value, key) => {
        institutionData[key] = value;
    });

    updateInstitutionDetails();
}


window.addEventListener("DOMContentLoaded", function () {
    getInstitutions().then(institutions => {
        institutionsList = institutions;
        renderInstitutionList(institutions);
    });
});

document.getElementById('submitBtn').addEventListener('click', async function () {
    const fileInputTiff = document.getElementById('fileInputTiff');
    if (!fileInputTiff.files.length) {
        alert('Please upload the .tif file');
        return;
    }
    const fileTiff = fileInputTiff.files[0];
    // Create an array containing all input boxes that need to be checked
    const filename = fileInputTiff.files[0].name.split('.')[0]
    const datasetName = filename.split('#')[0]
    const Modality = filename.split('#')[1]
    const Exposure = filename.split('#')[2]
    const Wavelength = filename.split('#')[3]
    const formData = new FormData();
    formData.append('dataset-name', datasetName);
    formData.append('modality', Modality);
    formData.append('exposure', Exposure);
    formData.append('wavelength', Wavelength);
    formData.append('FileName', fileTiff.name);
    formData.append('fileContent', fileTiff); // Add the file content here

    var fileExtension = fileInputTiff.files[0].name.split('.').pop().toLowerCase(); // Get file extension name
    if (fileExtension !== 'tif') {
        alert('Wrong file format! Please upload the .tif file');
        return;
    }

    // Start getProgress function
    shouldContinue = true;
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

            // If shouldContinue still true，invoke getProgress
            if (shouldContinue) {
                setTimeout(getProgress, 1000); // set 1 second delay time 
            }
        })
        .catch(error => {
            console.error('Fetch error:', error);
        });
}
function showOrderDetails(institutionName, poNumber) {
    fetch(`/getOrderDetails/${institutionName}/${poNumber}`)
        .then(response => response.json())
        .then(orderDetails => {
            // Create tables and headers
            const tableHTML = `
                <table class="table">
                    <tbody>
                        ${orderDetails.datasets.map(dataset => `
                            <tr>
                                <td>${dataset.name}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

            // Updated page to show order details and now displays the dataset in tabular form
            document.getElementById('orderDetails').innerHTML = tableHTML;
        })
        .catch(error => console.error('Error fetching order details:', error));
}


function generateAndInsertOrder(institutionName) {
    if (!document.getElementById('newPoNumber').value.length) {
        alert("Please enter a valid institution name.");
        return; // Early return to stop the function execution
    }

    const today = new Date().toISOString().slice(0, 10); // Get current date
    const newOrder = {
        PO_number: document.getElementById('newPoNumber').value,
        date: today,
        datasets: [] // Assume that the new order does not have a data set
    };

    // Send a request to the backend to insert a new order
    fetch('/insertOrder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ institutionName, newOrder }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('Order generated and inserted successfully!');
                window.location.reload(); // Refresh the page to show new orders
            } else {
                alert('Failed to generate and insert order.');
            }
        })
        .catch(error => console.error('Error:', error));
}

function populatePoNumberSelect(institutionName, currentPoNumber) {
    const poNumberSelect = document.getElementById('poNumberSelect');
    poNumberSelect.innerHTML = ''; // Clear existing options
    // Get order information from backend
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
    console.log(type, exposure, wavelength)
    fetch('/delete-wavelength', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        // Include datasetName in the request body
        body: JSON.stringify({
            datasetName: selectedDatasetName, // Using the global variable selectedDatasetName
            type,
            exposure,
            wavelength
        })
    })
        .then(response => response.json())
        .then(data => {
            console.log('Success:', data);
            // 更新数据视图的逻辑可以放在这里
            // 可能不想立即重载整个页面，而是更新显示的数据集列表
            // window.location.reload(); // 为了提供更好的用户体验，考虑不使用此行
            // updateDatasetDetails(selectedDatasetName); // 假设这是更新数据集详细信息的函数
        })
        .catch((error) => {
            console.error('Error:', error);
        });

    console.log(`Request sent to delete wavelength: ${wavelength} from type: ${type}, exposure: ${exposure}, for dataset: ${selectedDatasetName}`);
}


