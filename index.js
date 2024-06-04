require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { Storage } = require("@google-cloud/storage");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error(
    "GOOGLE_APPLICATION_CREDENTIALS not defined in the environment."
  );
  process.exit(1);
}

const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);

const storage = new Storage({
  credentials,
  projectId: "joshtalks-ias",
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 70 * 1024 * 1024, // Limit to 70MB
  },
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  try {
    const bucketName = "joshtalks-ias.appspot.com";
    let fileName = req.file.originalname.toLowerCase(); 

    if (fileName.includes(" ")) {
      return res
        .status(400)
        .send({ error: "File name should not contain spaces" });
    }

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(fileName);

  
    const [exists] = await file.exists();
    if (exists) {
      return res.status(400).send({ error: "File already exists" });
    }

    const blobStream = file.createWriteStream({
      resumable: false,
      gzip: true,
      metadata: {
        cacheControl: "public, max-age=31536000",
      },
    });

    blobStream.on("error", (err) => {
      res.status(500).send({
        error: "Error uploading to Google Cloud Storage",
        details: err.message,
      });
    });

    blobStream.on("finish", async () => {
      await file.makePublic();
      const url = `https://storage.googleapis.com/${bucketName}/${fileName}`;
      res.status(201).send({ message: "File uploaded successfully", url });
    });

    blobStream.end(req.file.buffer);
  } catch (error) {
    res
      .status(500)
      .send({ error: "Could not upload the file", details: error.message });
  }
});

app.listen(8001, () => {
  console.log("Server is running on port 8001");
});
