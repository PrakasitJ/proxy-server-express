import express from "express";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { stringify } from "flatted";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 3000;

const s3 = new S3Client({
  region: process.env.S3_REGION,
  forcePathStyle: true,
  endpoint: process.env.S3_URL,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_ACCESS_KEY_SECRET,
  },
});

// Utility function to convert a stream to a buffer
const streamToBuffer = (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
};

const read = async (name) => {
  const readCommand = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: name,
  });
  const object = await s3.send(readCommand);
  const byteArray = await streamToBuffer(object.Body); // Convert stream to buffer
  const length = object.ContentLength?.toString();

  return {
    data: byteArray,
    length: length ?? "0",
    contentType: object.ContentType ?? "application/octet-stream",
  };
};

app.get("/proxy/video/:name", async (req, res) => {
  const name = req.params.name;
  try {
    const { data, length, contentType } = await read(name);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "immutable, max-age=31536000");
    res.setHeader("Content-Length", length);
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Ensure that data is sent as a buffer or string
    if (Buffer.isBuffer(data) || typeof data === "string") {
      res.status(200).send(data);
    } else {
      // If data is an object, use flatted to serialize it safely
      res.status(200).send(stringify(data));
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Error retrieving file");
  }
});

app.listen(PORT, () => {
  console.log(`🦊 Express is running at http://localhost:${PORT}`);
});
