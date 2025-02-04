let institutionsList = [];
let currentSelectedInstitutionName;
let selectedUserEmail;
let selectedDatasetName;
let selectedAssignedDatasetName;
const assignedDatasetsTitle = document.getElementById('assignedDatasetsTitle');

window.addEventListener("DOMContentLoaded", usersTable())
window.addEventListener("DOMContentLoaded", renderDatasetList())
window.addEventListener("DOMContentLoaded", function () {
    getInstitutions().then(institutions => {
        institutionsList = institutions;
        populateInstitutionSelect(institutions);
        renderInstitutionList(institutions);
        populateUserInstitutionSelect(institutions);
    });
});

function renderInstitutionList(institutions) {
    const institutionList = document.getElementById('institutionList');
    institutionList.innerHTML = ''; // Clear existing content

    institutions.forEach((institution, index) => {
        const item = document.createElement('div');
        item.className = 'list-group-item list-group-item-action list-group';
        item.textContent = institution.name;
        item.onclick = () => {
            // Remove 'selected' class from all items
            document.querySelectorAll('#institutionList .list-group-item').forEach(el => {
                el.classList.remove('selected-inst');
            });
            // Add 'selected' class to clicked item
            item.classList.add('selected-inst');
            
            showInstitutionDetails(institution);
            currentSelectedInstitutionName = institution.name;
        };
        institutionList.appendChild(item);

        // Automatically select the first institution only if no current selection is stored
        if (index === 0 && !currentSelectedInstitutionName) {
            item.classList.add('selected-inst');
            showInstitutionDetails(institution);
        }
    });
}

document.getElementById('addDatasetBtn').addEventListener('click', function () {
    if (!selectedUserEmail || !selectedDatasetName) {
        return;
    }
    fetch(`/addAssignedDataset/${selectedUserEmail}/${selectedDatasetName}`, { method: 'POST' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            handleSelectedUser(selectedUserEmail);
            alert(data.message)
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
        });
});

// Delete selected datasets from Assigned Datasets
document.getElementById('removeDatasetBtn').addEventListener('click', function () {
    if (!selectedUserEmail || !selectedDatasetName) {
        return;
    }
    fetch(`/removeUserDataset/${selectedUserEmail}/${selectedDatasetName}`, { method: 'POST' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
                alert(data.message)
            }
            return response.json();
        })
        .then(data => {
            handleSelectedUser(selectedUserEmail);
            alert(data.message)
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
        });
});

document.getElementById('createUserBtn').addEventListener('click', function () {
    const email = document.getElementById('email').value;
    const institution = document.getElementById('institutionSelect').value;
    const level = document.getElementById('levelSelect').value;

    if (!email.trim()) {
        alert('Please enter an email address.');
        return;
    }

    fetch('/createUser', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email: email,
            institution: institution,
            level: level
        }),
    })
        .then(response => response.json())
        .then(data => {
            alert(data.message);  // Show alert if there is an error
            usersTable()
        })
        .catch(error => console.error('Error:', error));
});


document.getElementById("deleteUserBtn").addEventListener('click', () => {
    if (!selectedUserEmail || selectedUserEmail.trim() === "") {
        alert("Please select an user to delete");
        return; // This will exit the function early if no email is selected
    }
    // Confirm deletion
    let isConfirmed = confirm("You sure you want to delete it? Deletion cannot be undone.");
    if (!isConfirmed) {
        return; // If the user clicked "Cancel", exit the function early
    }
    //validate
    let email = selectedUserEmail
    //fetch
    fetch('/deleteUser', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            'email': email,
        }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                //updateTable
                usersTable()
                selectedUserEmail = " "
                // assignedDatasetsHead.textContent = `Assigned Datasets for ${selectedUserEmail}`;
                handleSelectedUser(selectedUserEmail)
            } else {
                // Display alert message
                alert(data.message);
            }

        })
        .catch((error) => {
            console.error('Error:', error)
        })

})

function getUsers() {
    return fetch('/getUsers')
        .then(response => response.json())
        .then(data => {
            return data.map(user => user.email);
        })
        .catch(error => {
            console.error('Error:', error);
            return [];
        });
}

function handleSelectedUser(selectedUserEmail) {
    assignedDatasetsTitle.textContent = `Assigned Datasets for ${selectedUserEmail}`;
    assignedDatasetsTitle.classList.add('assigned-datasets-title');
    const assignedDatasets = document.getElementById('assignedDatasets');
    // Empty the current datasets list
    assignedDatasets.innerHTML = '';
    // Query the datasets of selected user
    fetch(`/getUserDatasets/${selectedUserEmail}`, {
        method: 'GET',
    })
        .then(response => response.json())
        .then(datasets => {
            const datasetList = document.createElement('ul');
            datasetList.classList.add('list-group');
            datasets.forEach(dataset => {
                const li = document.createElement('li');
                li.classList.add('list-group-item');
                li.textContent = dataset;
                // Add click event listener
                datasetList.appendChild(li);
            });
            assignedDatasets.appendChild(datasetList);
            // Add event listener
            datasetList.addEventListener('click', (event) => {
                const selectedLi = event.target.closest('li');
                if (selectedLi) {
                    // Print the selected data set name on the console
                    selectedAssignedDatasetName = selectedLi.textContent
                    // Remove selected-dataset class from all other li elements
                    const allLiElements = document.querySelectorAll('#assignedDatasets li');
                    allLiElements.forEach((li) => {
                        if (li !== selectedLi) {
                            li.classList.remove('selected-dataset');
                        }
                    });
                    // Add selected-dataset class to selected li element
                    selectedLi.classList.add('selected-dataset');
                }
            });
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}

function usersTable(filterInstitution = 'all') {
    fetch('/getUsers', {
        method: 'GET',
    })
        .then(response => response.json())
        .then(data => {
            let filteredData = filterInstitution === 'all' ? data : data.filter(user => user.institution === filterInstitution);
            renderUserTable(filteredData);
        })
        .catch((error) => {
            console.error('Error:', error);
            document.getElementById("viewUsersCard").innerHTML = '<div class="alert alert-danger" role="alert">Failed to load user data.</div>';
        });
}
function renderUserTable(data) {
    // Initialize the table with headers
    let tableHTML = `
    <table>
        <tbody>
`;

    // Populate the table with data from existing users
    data.forEach((user, index) => {
        let date = formatDate(user.lastLogin ? user.lastLogin['$date'] : '');
        tableHTML += `<tr class="selectable-user" data-email="${user.email}">
        <td style="width: 30%;">${user.email}</td>
        <td style="width: 10%;">${user.level}</td>
        <td style="width: 10%;">${user.logins}</td>
        <td style="width: 30%;">${user.institution}</td>
        <td style="width: 30%;">${date}</td>
    </tr>`;
        if (index === 0) {
            selectedUserEmail = user.email;
        }
    });

    tableHTML += `</tbody></table>`;

    // Set the innerHTML of the usersCard to the new table
    const usersCard = document.getElementById("viewUsersCard");
    usersCard.innerHTML = tableHTML;

    // Add click event listeners to the user rows for selection functionality
    usersCard.querySelectorAll('.selectable-user').forEach((row, index) => {
        row.addEventListener('click', (event) => handleTableRowClick(event));
        if (index === 0) {
            row.classList.add('selected-user');
            handleSelectedUser(selectedUserEmail);
        }
    });
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function handleTableRowClick(event) {
    const selectedRow = event.target.closest('tr');
    if (selectedRow) {
        const rowData = {
            email: selectedRow.querySelector('td:nth-child(1)').textContent,
            level: selectedRow.querySelector('td:nth-child(2)').textContent,
            logins: selectedRow.querySelector('td:nth-child(3)').textContent,
            lastLogin: selectedRow.querySelector('td:nth-child(4)').textContent,
        };
        selectedUserEmail = rowData['email']
        handleSelectedUser(selectedUserEmail);
        // Remove the selected-row class from all other tr elements
        const allRows = document.querySelectorAll('tr');
        allRows.forEach((row) => {
            if (row !== selectedRow) {
                row.classList.remove('selected-user');
            }
        });
        // Add the selected-row class to the selected tr element, if it does not already have it
        if (!selectedRow.classList.contains('selected-user')) {
            selectedRow.classList.add('selected-user');
        }
    }
}

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

function renderDatasetList() {
    getDatasets().then(datasets => {
        const datasetList = document.getElementById('datasetList');
        datasetList.innerHTML = ''; // clear existing content
        const ul = document.createElement('ul');
        ul.classList.add('list-group');
        datasets.forEach(dataset => {
            const li = document.createElement('li');
            li.classList.add('list-group-item');
            li.dataset.name = dataset.name;
            li.textContent = dataset.name;
            ul.appendChild(li)
        });
        datasetList.appendChild(ul);
        ul.addEventListener('click', (event) => {
            const selectedLi = event.target.closest('li');
            if (selectedLi) {
                selectedDatasetName = selectedLi.dataset.name;
                // Remove the selected-dataset class from all other li elements
                const allLiElements = document.querySelectorAll('#datasetList li');
                allLiElements.forEach((li) => {
                    if (li !== selectedLi) {
                        li.classList.remove('selected-dataset');
                    }
                });
                // Add the selected-dataset class to the selected li element
                selectedLi.classList.add('selected-dataset');
            }
        });

    });
}

function populateInstitutionSelect(institutions) {
    const select = document.getElementById('institutionSelect');
    select.innerHTML = ''; // Clear all Options

    institutions.forEach(institution => {
        const option = document.createElement('option');
        option.value = institution.name;
        option.textContent = institution.name;
        select.appendChild(option);
    });
}

function populateUserInstitutionSelect(institutions) {
    const select = document.getElementById('userInstitutionFilter');
    select.innerHTML = '<option value="all">All Institutions</option>'; // Allow users to select all institutions

    institutions.forEach(institution => {
        const option = document.createElement('option');
        option.value = institution.name;
        option.textContent = institution.name;
        select.appendChild(option);
    });
}

document.getElementById('userInstitutionFilter').addEventListener('change', function () {
    const selectedInstitution = this.value;
    usersTable(selectedInstitution); // Pass in selected institution
});

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



document.getElementById('institutionForm').addEventListener('submit', function (e) {
    e.preventDefault();
    updateInstitutionDetails(); // Implement this function to handle form submission
});



document.getElementById('generateAndInsertOrderBtn').addEventListener('click', function () {

    if (!document.getElementById('newPoNumber').value.length) {
        alert("Please enter a valid Po Number.");
        return; // Early return to stop the function execution
    }

    const today = new Date().toISOString().slice(0, 10); // Get current date
    const newOrder = {
        PO_number: document.getElementById('newPoNumber').value,
        date: today,
        datasets: [] // Assume that the new order does not have a data set
    };
    console.log(currentSelectedInstitutionName, newOrder)
    fetch('/insertOrder', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentSelectedInstitutionName, newOrder }),
    })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('Order generated and inserted successfully!'); // Save current selected institution name
                getInstitutions().then(institutions => {
                    institutionsList = institutions;
                    // renderInstitutionList(institutions);
                    if (currentSelectedInstitutionName) {
                        const items = document.querySelectorAll('#institutionList .list-group-item');
                        items.forEach(item => {
                            if (item.textContent === currentSelectedInstitutionName) {
                                item.click();
                            }
                        });
                    }
                });
            } else {
                alert('Failed to generate and insert order.');
            }
        })
        .catch(error => console.error('Error:', error));
});

function populatePoNumberSelect(institutionName, currentPoNumber) {
    const poNumberSelect = document.getElementById('poNumberSelect');
    poNumberSelect.innerHTML = ''; // Clear existing options
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
        headers: {
            'Content-Type': 'application/json',
        },
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
        })
        .catch((error) => {
            console.error('Error:', error);
        });

    console.log(`Request sent to delete wavelength: ${wavelength} from type: ${type}, exposure: ${exposure}, for dataset:
${selectedDatasetName}`);
}

function updateOrderList(institutionName) {
    fetch(`/getOrdersByInstitution/${institutionName}`)
        .then(response => response.json())
        .then(orders => {
            const ordersContainer = document.querySelector('.orders-container'); // Change this selector to match your HTML
            ordersContainer.innerHTML = ''; // Clear existing orders

            orders.forEach(order => {
                const orderElement = document.createElement('div');
                orderElement.textContent = `PO Number: ${order.PO_number}, Date: ${order.date}`;
                ordersContainer.appendChild(orderElement);
            });
        })
        .catch(error => console.error('Error updating orders:', error));
}


