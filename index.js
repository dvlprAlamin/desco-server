const express = require('express');
const { MongoClient } = require('mongodb');
require('dotenv').config();
const cors = require('cors');

const app = express();


app.use(cors());
app.use(express.json());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vsgsy.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function run() {
    try {
        await client.connect();
        const database = client.db(process.env.DB_NAME);
        const billingCollection = database.collection('billing-list');

        // Get Billing data API
        app.get('/api/billing-list', async (req, res) => {
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
                bills = await cursor.toArray();
            }
            res.send(bills);
            // res.send({ count, bills });
        });

        // Post bills API
        app.post('/api/add-billing', async (req, res) => {
            const result = await billingCollection.insertOne(req.body)
            res.json(result)
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