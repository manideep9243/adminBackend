
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const csv = require("csv-parser");
const { MongoClient } = require("mongodb");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = 5000;

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
const uri = process.env.MONGO_URI || "mongodb+srv://22wj1a6673:avinash00725@cluster0.vecxz.mongodb.net/results?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);
const dbName = "Results";
const collectionName = "StudentResults";

// Configure Multer for file uploads
const upload = multer({ dest: "uploads/" });

// Admin Endpoint to Upload and Replace Data
app.post("/admin/upload", upload.single("file"), async (req, res) => {
  const filePath = req.file.path;

  try {
    const jsonData = [];
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Parse CSV File
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on("data", (row) => {
          // Validate required fields
          if (row.rollNumber && row.SUBCODE && row.SUBNAME) {
            jsonData.push(row);
          }
        })
        .on("end", resolve)
        .on("error", reject);
    });

    // Clear existing data
    await collection.deleteMany({});

    // Insert new data
    await collection.insertMany(jsonData);

    // Cleanup uploaded file
    fs.unlinkSync(filePath);

    res.status(200).json({ message: "New data uploaded successfully, and existing data replaced!" });
  } catch (error) {
    console.error("Error during file upload:", error);

    // Cleanup file in case of error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(500).json({ message: "Failed to process the uploaded file." });
  }
});

// Endpoint to Query Results by Roll Number
app.get("/results/:rollNumber", async (req, res) => {
  try {
    const rollNumber = req.params.rollNumber;
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Query the database
    const result = await collection.findOne({ rollNumber });

    if (result) {
      res.status(200).json(result);
    } else {
      res.status(404).json({ message: "Result not found for this roll number." });
    }
  } catch (error) {
    console.error("Error fetching result:", error);
    res.status(500).json({ message: "Failed to fetch result." });
  }
});

// Ensure Roll Number Indexing for Performance
client.connect().then(async () => {
  const db = client.db(dbName);
  const collection = db.collection(collectionName);

  // Create an index on the rollNumber field
  await collection.createIndex({ rollNumber: 1 });

  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
});
