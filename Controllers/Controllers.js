const { log } = console;
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ffmpeg1 = require("fluent-ffmpeg");
const { whispherHandle } = require("./AiController");
const { sendConfirmationMsg } = require("../MiddleWare/WhatsAppSendBacks");


const userState = {};


const audioHandle = async (message, TOK) => {
  const mediaId = message.audio.id;
  // log(JSON.stringify(message.audio) + "  Audio metadata received.\n\n");

  // Step 1: Get the media URL
  const mediaResponse = await axios.get(
    `https://graph.facebook.com/v18.0/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${TOK}` },
    }
  );

  const audioUrl = mediaResponse.data.url;
  // log(`Audio file available at: ${audioUrl}`);

  // Step 2: Fetch and save the actual audio file
  const dir = "media";
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const oggFilePath = path.join(dir, `media_file.ogg`);
  const wavFilePath = path.join(dir, `media_file.wav`); // Final converted file

  const audioResponse = await axios.get(audioUrl, {
    headers: { Authorization: `Bearer ${TOK}` },
    responseType: "stream",
  });

  // log("Saving audio to: ", oggFilePath);
  const writer = fs.createWriteStream(oggFilePath);
  audioResponse.data.pipe(writer);

  writer.on("finish", () => {
    console.log("Media file saved successfully as OGG.");

    // Step 3: Convert OGG to WAV
    ffmpeg1(oggFilePath)
      .toFormat("wav")
      .on("end", async () => {
        console.log("Conversion to WAV completed successfully!");

        // Now, call whisperHandle
        try {
          await whispherHandle(wavFilePath, message.from); // Pass the new WAV file
        } catch (error) {
          console.error("Error processing audio:", error);
        }
      })
      .on("error", (err) => {
        console.error("Error during conversion:", err);
      })
      .save(wavFilePath);
  });

  writer.on("error", (err) => {
    console.error("Error saving media file:", err);
  });
};

module.exports = { audioHandle };
