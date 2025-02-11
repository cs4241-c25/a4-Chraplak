const express = require('express');
//const fs = require("node:fs");
const app = express();
const port = 3000;
//const mime = require( "mime" );

app.use(express.static('public'));
app.use(express.json());

//const { MongoClient, ServerApiVersion } = require('mongodb');
const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://cchraplak:a4-chraplak@a4.jujm8.mongodb.net/?retryWrites=true&w=majority&appName=a4";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri);

// username getter
function getUserID(userCollection, parseData) {
    let userID = -1;
    for (let i = 0; i < userCollection.length; i++) {
        if (userCollection[i].user === parseData) {
            userID = userCollection[i]._id;
        }
    }
    return userID;
}

// database variable
let db;

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        db = await client.db("Data");
        await db.command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");

    } catch (e) {
        // Ensures that the client will close when you error
        await client.close();
        console.log("Connection closed");
        console.log(e);
    }
}
run().catch(console.dir);

app.use('/', (req, res, next) => {
    console.log('Request URL: ' + req.url);
    //next(); // go to the next middleware for this route

    let dataString = ""

    req.on( "data", function( data ) {
        console.log("Getting Data: " + data.toString());
        dataString += data
    });

    req.on( "end", async function() {
        console.log("End Data: " + dataString.toString());
        let parseData = "";
        try {
            parseData = JSON.parse(dataString);
            console.log("Data Received: " + parseData);
        }
        catch(e) {
            // return for robot
            console.log("No Data Input!");
            res.writeHead( 200, "OK", {"Content-Type": "text/plain" });
            res.end();
            return;
        }

        // gets data on database for quick access
        const locationCollection = await db.collection("Locations").find({}).toArray();
        const physicianCollection = await db.collection("Physicians").find({}).toArray();
        const userCollection = await db.collection("Users").find({}).toArray();
        const appointCollection = await db.collection("Appointments").find({}).toArray();

        switch (req.url) {
            case "/login":
                console.log("login!");

                // sets username
                let credentials = parseData.split("|");
                if (credentials.length === 2) {
                    for (let i = 0; i < userCollection.length; i++) {
                        if (userCollection[i].user === credentials[0] && credentials[0] !== "null") {
                            if (userCollection[i].pwd === credentials[1] && credentials[1] !== "null") {
                                console.log("Correct Password");
                                res.writeHead( 200, "OK", {"Content-Type": "text/plain" });
                                res.end(JSON.stringify({
                                    user: userCollection[i].user,
                                    status: "correct"
                                }));
                            }
                            else {
                                console.log("Wrong Password");
                                res.writeHead( 200, "OK", {"Content-Type": "text/plain" });
                                res.end(JSON.stringify({
                                    user: userCollection[i].user,
                                    status: "wrong"
                                }));
                            }
                            return;
                        }
                    }

                    // adds new user if not found
                    console.log("No User Found");
                    if (credentials[0].length === 0 || credentials[1].length === 0 || credentials[0] === "null" || credentials[1] === "null") {
                        console.log("Invalid credentials");
                        res.writeHead( 200, "OK", {"Content-Type": "text/plain" });
                        res.end(JSON.stringify({
                            user: "",
                            status: "invalid"
                        }));
                        return;
                    }

                    let id = 0;
                    if (userCollection.length > 0) {
                        id = userCollection[userCollection.length - 1]._id + 1;
                    }

                    let user = [{
                        _id: id,
                        user: credentials[0],
                        pwd: credentials[1],
                        appointments: []
                    }];
                    await db.collection("Users").insertMany(user);

                    res.writeHead( 200, "OK", {"Content-Type": "text/plain" });
                    res.end(JSON.stringify({
                        user: credentials[0],
                        status: "new"
                    }));
        }
        else {
            console.log("Invalid credentials");
            res.writeHead( 200, "OK", {"Content-Type": "text/plain" });
            res.end(JSON.stringify({
                user: "",
                status: "invalid"
            }));
        }

        break;
    case "/logout":
        console.log("Logging Out!");
        res.writeHead( 200, "OK", {"Content-Type": "text/plain" });
        res.end(JSON.stringify(""));
    break;
    case "/fetch":
        console.log("Fetching!");

        // gets initial data of appointments on server
        try {
            let userID = getUserID(userCollection, parseData);

            res.writeHead( 200, "OK", {"Content-Type": "text/plain" });
            if (userID >= 0) {
                let appointments = [];
                for (let i = 0; i < userCollection.length; i++) {
                    if (userCollection[i]._id === userID) {
                        let appointmentIDs = userCollection[i].appointments;
                        for (let j = 0; j < appointCollection.length; j++) {

                            const appointCollIndex = appointCollection[j]._id.indexOf("|");
                            const appointmentID = Number(appointCollection[j]._id.substring(appointCollIndex + 1, appointCollection[j]._id.length));
                            const userid = Number(appointCollection[j]._id.substring(0, appointCollIndex));

                            if (appointmentIDs.indexOf(appointCollection[j]._id) >= 0) {

                                let phys = -1;
                                for (let k = 0; k < physicianCollection.length; k++) {
                                    if (physicianCollection[k]._id === appointCollection[j].physicianID) {
                                        phys = physicianCollection[k].localID;
                                    }
                                }
                                let local = "";
                                let localID = -1;
                                for (let k = 0; k < locationCollection.length; k++) {
                                    if (locationCollection[k]._id === phys) {
                                        local = locationCollection[k].name;
                                        localID = locationCollection[k]._id;
                                    }
                                }

                                const item = {
                                    ID: appointmentID,
                                    Date: appointCollection[j].date,
                                    Time: appointCollection[j].time,
                                    Physicians: "name" + appointCollection[j].physicianID,
                                    Location: local,
                                    Description: appointCollection[j].description
                                }

                                appointments.push(item);
                            }
                        }
                    }
                }
                const converted = JSON.stringify( appointments );
                res.end(converted);
            }
            else {
                const converted = JSON.stringify( "" );
                res.end(converted);
            }
        }
        catch (e) {
            console.log("Error Fetching!");
        }
    break;
    case "/physicians":
        // gets list of available physicians for selection
        console.log("Physicians");
        try {
            let physNames = [];
            for (let i = 0; i < physicianCollection.length; i++) {
                physNames.push(physicianCollection[i].name);
            }
            res.writeHead( 200, "OK", {"Content-Type": "text/plain" });
            const convPhy = JSON.stringify( physNames );
            res.end(convPhy);
        }
        catch (e) {
            res.writeHead( 404, "OK", {"Content-Type": "text/plain" });
            res.end("Could not connect to the database!");
        }

    break;
    case "/local":
        // gets row to be edited
        console.log("Edit Appointment");
        let exists = false;

        let appUserID = getUserID(userCollection, parseData.userID);

        let appointmentIDs = [];
        for (let i = 0; i < userCollection.length; i++) {
            if (userCollection[i]._id === appUserID) {
                appointmentIDs = userCollection[i].appointments;
            }
        }

        for (let i = 0; i < appointmentIDs.length; i++) {
            let dataID = appUserID.toString() + "|" + parseData.ID;
            if (appointmentIDs.indexOf(dataID) >= 0) {
                // updates values to new values
                exists = true;
                const appointColl = await db.collection("Appointments");
                await appointColl.updateOne({_id: dataID}, {$set: {date: parseData.Date}});
                await appointColl.updateOne({_id: dataID}, {$set: {time: parseData.Time}});
                await appointColl.updateOne({_id: dataID}, {$set: {description: parseData.Description}});
                await appointColl.updateOne({_id: dataID}, {$set: {physicianID: parseInt(parseData.PhysicianID)}});
                let phys = -1;
                for (let j = 0; j < physicianCollection.length; j++) {
                    if (physicianCollection[j]._id.toString() === parseData.PhysicianID.toString()) {
                        phys = physicianCollection[j].localID;
                    }
                }
                let local = "";
                for (let j = 0; j < locationCollection.length; j++) {
                    if (locationCollection[j]._id === phys) {
                        local = locationCollection[j].name;
                    }
                }
                const converted = JSON.stringify( local );
                res.end(converted);
            }
        }
        if (!exists) {
            // adds new row if row id didn't exist
            console.log("Add Appointment");
            let phys = -1;
            for (let j = 0; j < physicianCollection.length; j++) {
                if (physicianCollection[j]._id.toString() === parseData.PhysicianID.toString()) {
                    phys = physicianCollection[j].localID;
                }
            }
            let local = "";
            let localID = -1;
            for (let j = 0; j < locationCollection.length; j++) {
                if (locationCollection[j]._id === phys) {
                    local = locationCollection[j].name;
                    localID = locationCollection[j]._id;
                }
            }

            let id = appUserID.toString() + "|" + parseData.ID.toString();

            let data = [{
                _id: id,
                date: parseData.Date,
                time: parseData.Time,
                physicianID: Number(parseData.PhysicianID),
                description: parseData.Description
            }];
            await db.collection("Appointments").insertMany(data);

            let existing = [];

            for (let i = 0; i < userCollection.length; i++) {
                if (userCollection[i]._id === appUserID) {
                    for (let j = 0; j < userCollection[i].appointments.length; j++) {
                        const appointCollIndex = userCollection[i].appointments[j].indexOf("|");
                        const appointmentID = Number(userCollection[i].appointments[j].substring(appointCollIndex + 1, userCollection[i].appointments[j].length));
                        const userid = Number(userCollection[i].appointments[j].substring(0, appointCollIndex));
                        if (userid === appUserID) {
                            existing = userCollection[i].appointments;
                        }
                    }
                }
            }

            existing.push(id);
            await db.collection("Users").updateOne({_id: appUserID}, {$set: {appointments: existing}});
            const converted = JSON.stringify( local );
            res.end(converted);
        }
    break;
    case "/remove":
        // gets row to be removed
        console.log("Remove Appointment");
        let found = false;
        const removeID = parseInt(parseData.RemoveID);

        let userID = getUserID(userCollection, parseData.UserID);

        console.log("Removing: " + userID.toString() + "|" + removeID.toString());

        try {
            const appointID = userID.toString() + "|" + removeID.toString();
            await db.collection("Appointments").deleteOne({_id: appointID});
            found = true;
        }
        catch (e) {
            console.log("Error Deleting Appointment");
            console.log(e);
        }
        if (!found) {
            console.log("No Appointments To Remove Found!!!");
        }
        res.writeHead( 200, "OK", {"Content-Type": "text/plain" });
        const convRem = JSON.stringify("Remove");
        res.end(convRem);
    break;
    default:
        // case not found
        console.log("Undefined Case");
        res.writeHead( 200, "OK", {"Content-Type": "text/plain" });
        const convUnd = JSON.stringify("Undefined Case");
        res.end(convUnd);
    break;
}
});
})

app.listen(process.env.PORT || port);