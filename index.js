const express = require("express");
const firebase = require("firebase-admin");
require("dotenv").config();
const app = express();
app.use(express.urlencoded({
    extended: true
}));
app.use(express.json());

/* Redirect http to https */
app.get("*", function (req, res, next) {

    if ("https" !== req.headers["x-forwarded-proto"] && "production" === process.env.NODE_ENV) {
        res.redirect("https://" + req.hostname + req.url);
    } else {
        // Continue to other routes if we're not redirecting
        next();
    }

});

firebase.initializeApp({
    credential: firebase.credential.cert(JSON.parse(process.env.CRED))
});

var db = firebase.firestore();

app.post('/create', (req, res) => {
    let docRef = db.collection('Customers').doc(req.body.username);
    if (req.body.name && req.body.email && req.body.gender && req.body.city) {
        docRef.set({
            name: req.body.name,
            email: req.body.email,
            gender: req.body.gender,
            city: req.body.city,
            regtoken: req.body.regtoken
        }).then(()=>{
        res.json({ message: 'Created' });})
        .catch((err)=>{
            res.json({message: "not created", error: err});
        });
    }
    else
        res.json({ message: 'Could not create' });
});

app.post('/read', async (req, res) => {
    let usr = [], customers;
    if (req.body.gender)
        customers = await db.collection('Customers').where("gender", "==", req.body.gender).get();
    else if (req.body.city)
        customers = await db.collection('Customers').where("city", "==", req.body.city).get();
    else
        customers = await db.collection('Customers').get();
    if (customers.docs.length > 0) {
        for (const user of customers.docs) {
            usr.push(user.data());
        }
    }
    res.json(usr);
});

app.put('/update', async (req, res) => {
    let docRef = db.collection('Customers').doc(req.body.username);
    if (req.body.name && req.body.email) { // batch 1
        await docRef.update({
            name: req.body.name,
            email: req.body.email,
        });
    }
    if (req.body.gender && req.body.city) { // Batch 2
        await docRef.update({
            gender: req.body.gender,
            city: req.body.city,
        });
    }
    res.json({ message: 'done' });
});

app.delete('/delete', async (req, res) => {
    db.collection('Customers').doc(req.body.username).delete()
    .then(()=>{
    res.json({ message: 'Deletion successful' })})
    .catch((e)=>{
        res.json({message: "Couldn't delete", error: e})
    });

});

app.post('/notify', async (req, res) => {
    let registrationTokens = [];
    let customers = await db.collection('Customers').where("city", "==", req.body.city).get();
    if (customers.docs.length > 0) {
        for (const user of customers.docs) {
            user.data().regtoken && registrationTokens.push(user.data().regtoken);
        }
    }
    else
        req.json({ message: "No customer in the city" });
    let message = {
        notification: {
            title: req.body.title,
            body: req.body.body
        },
        tokens: registrationTokens,
    };
    firebase.messaging().sendMulticast(message).then((response) => {
        res.json({ message: response.successCount + ' notification was sent successfully' });
    })
    .catch((err)=>{
        res.json({message: "Could not send notification", error: err});
    });
});

app.use(express.static('public'));

app.get('/', function (req, res) {
    res.sendFile(__dirname + "/" + "FCMtester.html");
});

var server = app.listen(process.env.PORT, function () {
    var host = server.address().address
    var port = server.address().port
    console.log("App listening at http://%s:%s", host, port);
});