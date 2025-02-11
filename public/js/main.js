// last row for creating new ids
let lastRow = 0;

// ids in order they appear on rows
const ids = ["date", "time", "primary", "text"];

// list of available physicians to choose
let physicians = [];

// gets data from server
const pingServer = async function( data, route ) {

    let body = JSON.stringify( data );
    const phyResponse = await fetch( route, {
        method:'POST',
        body
    });
    const test = await phyResponse.text();
    return JSON.parse(test);
}

// adds HTML elements to table
const addElements = function( newID ) {

    let row = document.createElement("tr");
    row.id = "row" + newID.toString();

    // corner HTML
    let tdCorner = document.createElement("td");
    tdCorner.className = "corner";
    let formx = document.createElement("form");
    formx.id = "form" + newID.toString();

    // edit corner HTML
    let editx = document.createElement("button");
    editx.id = "edit" + newID;
    editx.className = "edit modify";
    editx.innerHTML = "&#9998;";
    editx.ariaLabel = "Edit Row";
    editx.onclick = async function(event) {
        return editRow(event, newID);
    }

    // remove corner HTML
    let removex = document.createElement("button");
    removex.id = "edit" + newID;
    removex.className = "edit remove";
    removex.innerHTML = "-";
    removex.ariaLabel = "Remove Row";
    removex.onclick = async function(event) {
        return removeRow(event, newID);
    }

    // append corner
    formx.appendChild(editx);
    formx.append("\u00A0");
    formx.appendChild(removex);
    tdCorner.appendChild(formx);

    // date
    let tdDate = document.createElement("td");
    tdDate.className = "date";
    let datex = document.createElement("input");
    datex.form = formx;
    datex.type = "date";
    datex.className = "form" + newID.toString() + " date-button";
    datex.id = "date" + newID.toString();
    datex.disabled = true;
    datex.ariaLabel = "Edit Date";

    tdDate.appendChild(datex);

    // time
    let tdTime = document.createElement("td");
    tdTime.className = "time";
    let timex = document.createElement("input");
    timex.form = formx;
    timex.type = "time";
    timex.id = "time" + newID.toString();
    timex.className = "form" + newID.toString() + " time-button";
    timex.disabled = true;
    timex.ariaLabel = "Edit Time";

    tdTime.appendChild(timex);

    // primary physician
    let tdprimary = document.createElement("td");
    tdprimary.className = "primary";
    let primaryx = document.createElement("select");
    primaryx.form = formx;
    primaryx.id = "primary" + newID.toString();
    primaryx.className = "form" + newID.toString() + " primary-select";
    primaryx.disabled = true;
    primaryx.ariaLabel = "Select Physician";

    // primary physician options
    let defaultPhy = document.createElement("option");
    defaultPhy.disabled = true;
    defaultPhy.defaultSelected = true;
    defaultPhy.innerHTML = "Select Physician";
    primaryx.appendChild(defaultPhy);
    for (let i = 0; i < physicians.length; i++) {
        let option = document.createElement("option");
        option.value = "name" + (i).toString();
        option.innerHTML = physicians[i];
        option.className = "option-button";
        primaryx.appendChild(option);
    }

    tdprimary.appendChild(primaryx);

    // local
    let tdlocal = document.createElement("td");
    tdlocal.className = "local";
    let localx = document.createElement("span");
    localx.id = "local" + newID.toString();
    localx.className = "form" + newID.toString() + " local-span";
    tdlocal.appendChild(localx);

    // description
    let tdtext = document.createElement("td");
    tdtext.className = "description"
    let textx = document.createElement("textarea");
    textx.form = formx;
    textx.id = "text" + newID.toString();
    textx.className = "text form" + newID.toString();
    textx.disabled = true;
    textx.ariaLabel = "Edit Appointment Details";

    tdtext.appendChild(textx);

    // row append
    row.appendChild(tdCorner);
    row.appendChild(tdDate);
    row.appendChild(tdTime);
    row.appendChild(tdprimary);
    row.appendChild(tdlocal);
    row.appendChild(tdtext);
    document.getElementById("appointments-body").appendChild(row);
}

// adds new row to table
const addRow = async function( event ) {
    event.preventDefault();

    lastRow++;
    const newID = lastRow;

    addElements(newID);
}

// edits data in row
const editRow = async function( event, id ) {
    // stop form submission from trying to load
    // a new .html page for displaying results...
    // this was the original browser behavior and still
    // remains to this day
    event.preventDefault();

    let enabled = true;
    let filled = true;

    // verifies all data is filled in to save to server
    for (let i = 0; i < ids.length; i++) {
        let element = document.getElementById(ids[i] + id.toString());
        if (element.value === "") {
            filled = false;
        }
    }

    if (filled || document.getElementById("edit" + id.toString()).innerHTML === "✎") {

        let appointment = {
            "userID": localStorage.getItem("username"),
            "ID": id,
            "Date": "",
            "Time": "",
            "PhysicianID": -1,
            "Description": ""
        }

        for (let i = 0; i < ids.length; i++) {
            // toggles row elements to be editable or not editable
            let element = document.getElementById(ids[i] + id.toString());
            if (element.disabled) {
                element.disabled = false;
                enabled = false;
            }
            else {
                element.disabled = true;
                enabled = true;
            }
            // stores data to send to server
            switch (i) {
                case 0:
                    appointment.Date = element.value;
                    break;
                case 1:
                    appointment.Time = element.value;
                    break;
                case 2:
                    appointment.PhysicianID = element.value.substring(4, element.value.length);
                    break;
                case 3:
                    appointment.Description = element.value;
                    break;
            }
        }

        let editButton = document.getElementById("edit" + id.toString());

        if (enabled) {
            editButton.innerHTML = "&#9998;";

            // get location
            const local = await pingServer(appointment, "/local");
            document.getElementById("local" + id.toString()).innerHTML = local;
        }
        else {
            editButton.innerHTML = "&#10003;";
        }
    }
    else {
        alert("Missing Parameters!!!");
    }
}

// removes row from page and server
const removeRow = async function( event, id ) {
    event.preventDefault()

    // remove HTML
    let row = document.querySelector("#row" + id.toString());
    row.parentNode.removeChild(row);

    // remove from server
    await pingServer({"RemoveID": localStorage.getItem("username")}, "/remove");
}

// logs out user
const logout = async function( event ) {

    event.preventDefault();
    localStorage.removeItem("username");
    localStorage.removeItem("password");
    document.getElementById("appointments-body").innerHTML = "";
    lastRow = 0;

    document.getElementById("login-header").innerHTML = "Login";
    document.getElementById("add").hidden = true;
    document.getElementById("add").disabled = true;

    // logs out user
    await pingServer("logout", "/logout");
}

// removes row from page and server
const loadData = async function( local ) {

    let user = "";
    let pwd = "";

    if (local) {
        try {
            user = localStorage.getItem("username");
            pwd = localStorage.getItem("password");
        }
        catch (e) {
            console.log("No session loaded!");
        }
    }
    else {
        user = document.getElementById("username").value;
        pwd = document.getElementById("password").value;
    }

    // get login credentials
    const userParse = await pingServer(user + "|" + pwd, "/login");

    if (!local) {
        if (userParse.status === "new") {
            alert("Created New Account!");
        }
        else if (userParse.status === "wrong") {
            alert("Wrong Account Credentials!");
        }
        else if (userParse.status === "invalid") {
            alert("Invalid Account Credentials!");
        }
    }
    if ((userParse.status === "correct" || userParse.status === "new") && document.getElementById("login-header").innerHTML !== "Welcome " + userParse.user + "!") {

        localStorage.setItem("username", user);
        localStorage.setItem("password", pwd);

        document.getElementById("login-header").innerHTML = "Welcome " + userParse.user + "!";
        document.getElementById("appointments-body").innerHTML = "";
        document.getElementById("add").hidden = false;
        document.getElementById("add").disabled = false;

        // get initial appointments stored
        const appointments = await pingServer(localStorage.getItem("username"), "/fetch");

        document.getElementById("appointments-body").innerHTML = "";

        // updates data in HTML form
        for (let i = 0; i < appointments.length; i++) {
            lastRow = parseInt(appointments[i].ID);
            addElements(lastRow);
            let date = document.getElementById("date" + lastRow.toString());
            date.value = appointments[i].Date;
            let time = document.getElementById("time" + lastRow.toString());
            time.value = appointments[i].Time;
            let primary = document.getElementById("primary" + lastRow.toString());
            primary.value = appointments[i].Physicians;
            let local = document.getElementById("local" + lastRow.toString());
            local.innerHTML = appointments[i].Location;
            let text = document.getElementById("text" + lastRow.toString());
            text.innerHTML = appointments[i].Description;
        }
    }
}

window.onload = async function() {

    // functionality for adding row
    let addButton = document.getElementById("add");
    addButton.onclick = addRow;

    // gets list of physicians
    physicians = await pingServer("physicians", "/physicians");

    document.getElementById("submit").onclick = async function(event) {
        event.preventDefault();
        await loadData(false);
    }

    document.getElementById("logout").onclick = logout;

    await loadData(true);
}
