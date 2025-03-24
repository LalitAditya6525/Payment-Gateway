const express = require('express');
const bodyParser = require('body-parser');
const paypal = require('@paypal/checkout-server-sdk');
const app = express();
const port = 3000;

// PayPal environment setup
const environment = new paypal.core.SandboxEnvironment('YOUR_CLIENT_ID', 'YOUR_SECRET');
const client = new paypal.core.PayPalHttpClient(environment);

app.use(express.static('.'));
app.use(bodyParser.json());

app.post('/create-order', async (req, res) => {
    const request = new paypal.orders.OrdersCreateRequest();
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'USD',
                value: req.body.amount
            }
        }]
    });

    try {
        const order = await client.execute(request);
        res.json({ id: order.result.id });
    } catch (err) {
        res.status(500).send(err.toString());
    }
});

app.post('/capture-order/:orderID', async (req, res) => {
    const request = new paypal.orders.OrdersCaptureRequest(req.params.orderID);
    request.requestBody({});

    try {
        const capture = await client.execute(request);
        res.json(capture.result);
    } catch (err) {
        res.status(500).send(err.toString());
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
