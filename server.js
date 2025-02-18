const express = require('express');
const app = express();
const port = 3000;
/*const dotenv =*/ require('dotenv').config();
const { MongoClient, Collection } = require('mongodb'); // Note that Collection is only used with JSDocs. It is NOT required.
const passport = require('passport');
const session = require('express-session')
const GitHubStrategy = require('passport-github2').Strategy;

// Github OAuth
const GITHUB_CLIENT_ID = "Ov23liAOeMukldZ9UoJv";
const GITHUB_CLIENT_SECRET = "b2e47e66be6ff61d7dd6929feb2e8a612be9f1a3";

// Express Session
const EXPRESS_SESSION_SECRET = "expresssecret";

app.use(session({
    secret: EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());

const uri = "mongodb+srv://cchraplak:a4-chraplak@a4.jujm8.mongodb.net/?retryWrites=true&w=majority&appName=a4";
const client = new MongoClient(uri);

// region DB Connection
// Connect to the DB
// These JSDocs make it more convenient to work with the collections since the IDE knows that functions each Collection can use.
/**
 * @type {Collection}
 */
let DBCollection = null;
let db;
/**
 * Connects to the MongoDB database
 */
async function connectToDB() {

    // Note that this connect call is not intended for use in production
    await client.connect();
    db = await client.db("Data");
    DBCollection = await db.collection("Users").find({}).toArray();
    console.log("Connected to MongoDB");
}

connectToDB();

// Middleware to check connection to DB
app.use((req, res, next) => {
    console.log("req url: " + req.url + ", res: " + JSON.stringify(req.body));
    if (DBCollection !== null) {
        next();
    } else {
        // Could not connect to the DB. Send an error.
        console.log("Error connecting!");
        res.sendStatus(503);
    }
});
// endregion

// region User Serialization
/**
 * Serialize the user.
 * Every time the user logs in, it stores the data in `done`'s `id` parameter (the one after null) in `req.user`.
 */
passport.serializeUser(function (user, done) {
    // I use user._id || user.id to allow for more flexibility of this with MongoDB.
    // If using Passport Local, you might want to use the MongoDB id object as the primary key.
    // However, we are using GitHub, so what we want is user.id
    // Feel free to remove the user._id || part of it, but the `user.id` part is necessary.
    done(null, { username: user.username, id: user._id || user.id });
});

/**
 * Deserialize the user.
 * Every time the user's session is ended, it removes `obj` from the user's req.
 */
passport.deserializeUser(function (obj, done) {
    done(null, obj);
});
// endregion
// region Strategy

/**
 * Create the GitHub Strategy.
 *
 * Note that the callback URL is OPTIONAL. If it is not provided, it will default to the one configured
 * in GitHub. See the README for information on how to set that up.
 *
 * If you do decide to include the callbackURL, it must be EXACT. Any missmatch from the GitHub one and it will
 * fail.
 */

const gitStrategy = new GitHubStrategy({
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: "https://a4-camren-chraplak.glitch.me/auth/github/callback"
    },
    async function (accessToken, refreshToken, profile, done) {
        // This code will run when the user is successfully logged in with GitHub.
        process.nextTick(function () {
            return done(null, profile);
        });
    }
);

passport.use(gitStrategy);
// endregion
// region GitHub Routes
// This is the callback to put in GitHub. If the authentication fails, it will redirect them to '/login'.
app.get('/auth/github/callback',
    passport.authenticate('github', { session: true, failureRedirect: '/login' }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect('/');
    });

// The route to redirect the user to when you want to actually have them log in with GitHub.
// It is what happens when you click on the "Log in with GitHub" button.
// Note that the scope is 'user:email'. You can read more about possible scopes here:
// https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
// You should not need anything other than the 'user:email' if just authenticating with GitHub.
// <a href="/auth/github">Login with GitHub</a>
app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
// endregion

function ensureAuth(req, res, next) {
    if (req.isAuthenticated()) {
        next();
    } else {
        res.redirect("/login");
    }
}

// region login and root routes
app.get('/', ensureAuth, (req, res) => {
    // User is logged in
    res.sendFile(__dirname + "/public/index.html");
});

app.get("/login", (req, res) => {
    // User is logged in
    console.log("Login!");
    if (req.user) {
        res.redirect("/");
    } else {
        // User is not logged in
        res.sendFile(__dirname + "/public/login.html");
    }
});
// endregion

// Have the user go to /logout and it will log them out.
// i.e. <a href="/logout">Logout</a>
app.get("/logout", (req, res) => {
    console.log("Logout!");
    req.logout(() => { });
    res.redirect('/');
});

app.use(express.static('public'));

app.get("/load", ensureAuth, async (req, res) => {
    console.log("Load!");
    // Note that here I am using the username as the key.
    //const userdata = await DBCollection.find({ username: req.user.username }).toArray();
    const username = req.user.username;
    const userdata = await db.collection("Users").find({ user: username }).toArray();

    // adds new user to database
    if (!userdata) {
        const userCollection = await db.collection("Users").find({}).toArray();
        let id = 0;
        if (userCollection.length > 0) {
            id = userCollection[userCollection.length - 1]._id + 1;
        }

        let user = [{
            _id: id,
            user: username,
            appointments: []
        }];
        await db.collection("Users").insertMany(user);
    }
    // What I am doing here is attaching the username to the front of the array
    // and then putting the rest of the data after the username
    res.json([{ user: username }]);
});

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

app.use('/fetch', (req, res) => {
    console.log("Fetch Root");
    console.log('Request URL: ' + req.url);

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
                            //const userid = Number(appointCollection[j]._id.substring(0, appointCollIndex));

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
    });
});

app.use('/physicians', (req, res) => {
    console.log("Physician Root");
    console.log('Request URL: ' + req.url);

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
        const physicianCollection = await db.collection("Physicians").find({}).toArray();

        // gets list of available physicians for selection
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
    });
});

app.use('/local', (req, res) => {
    console.log("Edit Root");
    console.log('Request URL: ' + req.url);

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

        // gets row to be edited
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
                console.log("Edit existing appointment");
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
                        //const appointmentID = Number(userCollection[i].appointments[j].substring(appointCollIndex + 1, userCollection[i].appointments[j].length));
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
    });
});

app.use('/remove', (req, res) => {
    console.log("Remove Root");
    console.log('Request URL: ' + req.url);

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
        const userCollection = await db.collection("Users").find({}).toArray();

        // gets row to be removed
        let found = false;
        const removeID = parseInt(parseData.RemoveID);

        let userID = getUserID(userCollection, parseData.UserID);

        console.log("Removing: " + userID.toString() + "|" + removeID.toString());

        try {
            const appointID = userID.toString() + "|" + removeID.toString();
            await db.collection("Appointments").deleteOne({_id: appointID});
            const existing = await db.collection("Users").find({ user: parseData.UserID }).toArray();
            let appointments = existing[0].appointments;
            const index = appointments.indexOf(appointID);
            if (index >= 0) {
                appointments.splice(index, 1);
                await db.collection("Users").updateOne({_id: userID}, {$set: {appointments: appointments}});
                found = true;
            }
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
    });
});

app.listen(process.env.PORT || port, () => {
    console.log("Server listening on port " + port);
});