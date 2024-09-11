const express = require("express");
const multer = require("multer");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const app = express();

// Middleware to parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Multer configuration for file uploads (logo, signature)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Folder to store uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
  },
});

const upload = multer({ storage: storage });

// Endpoint to handle invoice generation
app.post(
  "/generate-invoice",
  upload.fields([{ name: "logo" }, { name: "signature" }]),
  (req, res) => {
    // Accessing text fields
    const sellerDetails = JSON.parse(req.body.sellerDetails);
    const billingDetails = JSON.parse(req.body.billingDetails);
    const shippingDetails = JSON.parse(req.body.shippingDetails);
    const orderDetails = JSON.parse(req.body.orderDetails);
    const invoiceDetails = JSON.parse(req.body.invoiceDetails);
    const items = JSON.parse(req.body.items);
    const placeOfSupply = req.body.placeOfSupply;
    const placeOfDelivery = req.body.placeOfDelivery;
    const reverseCharge = req.body.reverseCharge;

    // Accessing file uploads (logo and signature)
    const logoFile = req.files["logo"] ? req.files["logo"][0].path : null;
    const signatureFile = req.files["signature"]
      ? req.files["signature"][0].path
      : null;

    // Generate PDF invoice
    const invoiceFileName = `invoice-${invoiceDetails.invoiceNo}.pdf`;
    const invoicePath = path.join(__dirname, "invoices", invoiceFileName);
    generateInvoicePDF(
      {
        sellerDetails,
        billingDetails,
        shippingDetails,
        orderDetails,
        invoiceDetails,
        placeOfSupply,
        placeOfDelivery,
        reverseCharge,
        items,
        logoFile,
        signatureFile,
      },
      invoicePath
    );

    res.json({
      message: "Invoice generated successfully",
      path: `/invoices/${invoiceFileName}`, // Serve this file to the user
    });
  }
);

// PDF generation function
function generateInvoicePDF(data, filePath) {
  const doc = new PDFDocument();

  // Stream the PDF to a file
  doc.pipe(fs.createWriteStream(filePath));

  // Add logo if available
  if (data.logoFile) {
    doc.image(data.logoFile, 50, 50, { width: 100 });
  }

  // Invoice Header
  doc.fontSize(20).text("Invoice", { align: "center" });

  // Seller Details
  doc.fontSize(12).text(`Seller: ${data.sellerDetails.name}`);
  doc.text(
    `Address: ${data.sellerDetails.address}, ${data.sellerDetails.city}, ${data.sellerDetails.state}, ${data.sellerDetails.pincode}`
  );
  doc.text(`PAN: ${data.sellerDetails.pan}`);
  doc.text(`GST: ${data.sellerDetails.gst}`);

  doc.moveDown();

  // Invoice Details
  doc.text(`Invoice No: ${data.invoiceDetails.invoiceNo}`);
  doc.text(`Invoice Date: ${data.invoiceDetails.invoiceDate}`);
  doc.text(`Order No: ${data.orderDetails.orderNo}`);
  doc.text(`Order Date: ${data.orderDetails.orderDate}`);
  doc.moveDown();

  // Billing and Shipping Details
  doc.text("Billing Details:", { underline: true });
  doc.text(`${data.billingDetails.name}`);
  doc.text(
    `${data.billingDetails.address}, ${data.billingDetails.city}, ${data.billingDetails.state}, ${data.billingDetails.pincode}`
  );
  doc.text(`State Code: ${data.billingDetails.stateCode}`);

  doc.moveDown();

  doc.text("Shipping Details:", { underline: true });
  doc.text(`${data.shippingDetails.name}`);
  doc.text(
    `${data.shippingDetails.address}, ${data.shippingDetails.city}, ${data.shippingDetails.state}, ${data.shippingDetails.pincode}`
  );
  doc.text(`State Code: ${data.shippingDetails.stateCode}`);

  doc.moveDown();

  // Place of Supply and Delivery
  doc.text(`Place of Supply: ${data.placeOfSupply}`);
  doc.text(`Place of Delivery: ${data.placeOfDelivery}`);
  doc.text(`Reverse Charge: ${data.reverseCharge}`);

  doc.moveDown();

  // Table header
  doc.text("Item Description", 50, doc.y);
  doc.text("Unit Price", 200, doc.y);
  doc.text("Quantity", 300, doc.y);
  doc.text("Discount", 350, doc.y);
  doc.text("Net Amount", 400, doc.y);
  doc.moveDown();

  // Items
  data.items.forEach((item) => {
    const netAmount = item.unitPrice * item.quantity - item.discount;
    doc.text(item.description, 50, doc.y);
    doc.text(item.unitPrice, 200, doc.y);
    doc.text(item.quantity, 300, doc.y);
    doc.text(item.discount, 350, doc.y);
    doc.text(netAmount, 400, doc.y);
    doc.moveDown();
  });

  // Signature if available
  if (data.signatureFile) {
    doc.moveDown();
    doc.image(data.signatureFile, 50, doc.y, { width: 100 });
    doc.text("Authorized Signatory", 50, doc.y + 50);
  }

  // Finalize the PDF and end the stream
  doc.end();
}

// Serve the generated invoices as static files
app.use("/invoices", express.static(path.join(__dirname, "invoices")));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
