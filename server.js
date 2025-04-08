require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const paypalCheckout = require('@paypal/checkout-server-sdk');
const paypalPayouts = require('@paypal/payouts-sdk');

const app = express();
const port = 3000;

app.use(express.static('.'));
app.use(bodyParser.json());

// PayPal Environment Setup
const checkoutEnv = new paypalCheckout.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_SECRET);
const payoutsEnv = new paypalPayouts.core.SandboxEnvironment(process.env.PAYPAL_CLIENT_ID, process.env.PAYPAL_SECRET);
const checkoutClient = new paypalCheckout.core.PayPalHttpClient(checkoutEnv);
const payoutsClient = new paypalPayouts.core.PayPalHttpClient(payoutsEnv);

// Create Order
app.post('/create-order', async (req, res) => {
    const { amount } = req.body;
    const request = new paypalCheckout.orders.OrdersCreateRequest();
    request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
            amount: {
                currency_code: 'USD',
                value: amount
            }
        }]
    });

    try {
        const order = await checkoutClient.execute(request);
        res.json({ id: order.result.id });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Capture Order and Split Payment
app.post('/capture-order/:orderID', async (req, res) => {
    const orderID = req.params.orderID;
    const request = new paypalCheckout.orders.OrdersCaptureRequest(orderID);
    request.requestBody({});

    try {
        const capture = await checkoutClient.execute(request);
        const capturedAmount = parseFloat(
            capture.result.purchase_units[0].payments.captures[0].amount.value
        );

        // 5% to merchant
        const merchantEmail = "merchant@example.com";
        const merchantShare = (capturedAmount * 0.05).toFixed(2);

        // 95% divided equally among sellers
        const sellers = [
            "seller1@example.com",
            "seller2@example.com"
        ];
        const sellerAmount = ((capturedAmount * 0.95) / sellers.length).toFixed(2);

        // Build recipients list
        const payoutItems = [
            {
                email: merchantEmail,
                amount: merchantShare
            },
            ...sellers.map(email => ({
                email,
                amount: sellerAmount
            }))
        ];

        const payout = await sendPayout(payoutItems);

        res.json({
            message: "Payment captured and split",
            paymentDetails: capture.result,
            payoutDetails: payout
        });
    } catch (error) {
        console.error('Error capturing or paying out:', error);
        res.status(500).json({ error: 'Payment processing failed' });
    }
});

// Send Payout
async function sendPayout(recipients) {
    const request = new paypalPayouts.payouts.PayoutsPostRequest();
    request.requestBody({
        sender_batch_header: {
            sender_batch_id: `batch_${Date.now()}`,
            email_subject: "You've received a payment!"
        },
        items: recipients.map((recipient, index) => ({
            recipient_type: "EMAIL",
            receiver: recipient.email,
            amount: {
                value: recipient.amount,
                currency: "USD"
            },
            note: "Your payout",
            sender_item_id: `item_${index}`
        }))
    });

    try {
        const response = await payoutsClient.execute(request);
        return response.result;
    } catch (error) {
        console.error("Payout error:", error);
        throw new Error("Payout failed");
    }
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
