const express = require('express');
const { MongoClient } = require('mongodb');
require('dotenv').config();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ObjectId = require('mongodb').ObjectId;
const app = express();


app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vsgsy.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = await req.headers.authorization.split('Bearer ')[1];
        const user = jwt.verify(token, process.env.JWT_SECRET);
        req.decodedEmail = user.email;
    }
    next();
}


const formValidation = data => {
    let message = ''
    const emailRegexp = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (data.email !== undefined && !emailRegexp.test(data.email)) {
        return message = 'invalid email'
    } else if (data.phone !== undefined && data.phone?.length !== 11) {
        return message = 'Phone number must be 11 digit'
    } else {
        return message
    }

}

async function run() {
    try {
        await client.connect();
        const database = client.db(process.env.DB_NAME);
        const billingCollection = database.collection('billing-list');
        const userCollection = database.collection('user');
        // Get Billing data API
        app.get('/api/billing-list', verifyToken, async (req, res) => {
            // verifyToken
            const validUser = await userCollection.findOne({ email: req.decodedEmail });
            if (validUser !== null) {
                const cursor = billingCollection.find({});
                const sorted = cursor.sort({ _id: -1 })
                const page = req.query.page;
                const size = parseInt(req.query.size);
                let bills;
                const count = await cursor.count();
                if (page) {
                    bills = await sorted.skip(page * size).limit(size).toArray();
                }
                else {
                    bills = await sorted.toArray();
                }
                res.send({ count, bills });
            } else {
                res.status(401).json({ message: 'User not authorized' })
            }
        });

        // Post bills API
        app.post('/api/add-billing', async (req, res) => {
            const invalidMessage = formValidation(req.body);
            if (!invalidMessage) {
                const result = await billingCollection.insertOne(req.body)
                res.json(result)
            } else {
                res.status(400).json({ message: invalidMessage })
            }

        })
        //Update bills API
        app.put('/api/update-billing/:id', async (req, res) => {
            const invalidMessage = formValidation(req.body);
            if (!invalidMessage) {
                const id = ObjectId(req.params.id);
                const data = req.body;
                const filter = { _id: id };
                const options = { upsert: true };
                const updateDoc = { $set: data };
                const result = await billingCollection.updateOne(filter, updateDoc, options);
                res.json(result.modifiedCount > 0);
            } else {
                res.status(400).json({ message: invalidMessage })
            }

        })
        // Delete bills API
        app.delete('/api/delete-billing/:id', async (req, res) => {
            const id = ObjectId(req.params.id);
            const result = await billingCollection.findOneAndDelete({ _id: id })
            res.send(result)
        })
        // User Register API
        app.post('/api/registration', async (req, res) => {
            const { name, email, password } = req.body;
            const isExist = await userCollection.findOne({ email })
            if (isExist) {
                res.status(409).json({ message: 'Email already exists' })
            } else {
                const encryptPass = await bcrypt.hash(password, 10);
                const result = await userCollection.insertOne({ name, email, password: encryptPass });
                res.json(result)
            }
        })

        // User Login API
        app.post('/api/login', async (req, res) => {
            const { email, password } = req.body;
            const user = await userCollection.findOne({ email })
            if (!user) {
                return res.status(400).json({ message: 'Invalid Email' })
            }
            if (await bcrypt.compare(password, user.password)) {
                const token = jwt.sign({
                    id: user._id,
                    email: user.email
                }, process.env.JWT_SECRET)
                res.status(200).send({ status: true, token: token, email: user.email })
            } else {
                res.status(400).send({ status: false, message: "Password didn't match" })
            }
        })

    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('server is ok');
});
const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log('listen', port);
})