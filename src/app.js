import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import Joi from "joi";

// Criação do app
const app = express();

// Configurações
app.use(cors());
app.use(express.json());
dotenv.config();

// conexão com o banco
console.log(process.env.DATABASE_URL);
const mongoClient = new MongoClient(process.env.DATABASE_URL);

try {
  await mongoClient.connect();
  console.log("MongoDB conectado!");
} catch (err) {
  console.log(err.message);
}

const db = mongoClient.db();

// post /participants
app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const schemaParticipant = Joi.object({
    name: Joi.string().required(),
  });

  const validation = schemaParticipant.validate(req.body, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const user = await db.collection("participants").findOne({ name });
    if (user) return res.sendStatus(409);

    const timestamp = Date.now();

    await db.collection("participants").insertOne({ name, lastStatus: timestamp });

    const message = {
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs(timestamp).format("HH:mm:ss"),
    };

    await db.collection("messages").insertOne(message);

    res.sendStatus(201);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// get /participants
app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// post /messages
app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const user = req.headers.user;

  const schemaParticipant = Joi.object({
    from: Joi.string().required(),
    to: Joi.string().required(),
    text: Joi.string().required(),
    type: Joi.string().required().valid("message", "private_message"),
  });

  const validation = schemaParticipant.validate({ ...req.body, from: user }, { abortEarly: false });

  if (validation.error) {
    const errors = validation.error.details.map((detail) => detail.message);
    return res.status(422).send(errors);
  }

  try {
    const participant = await db.collection("participants").findOne({ name: user });
    console.log(participant);
    if (!participant) {
      return res.sendStatus(422);
    }

    const message = {
      ...req.body,
      from: user,
      time: dayjs().format("HH:mm:ss"),
    };

    await db.collection("messages").insertOne(message);
    return res.sendStatus(201);
  } catch (err) {
    return res.sendStatus(500);
  }
});

// get messages
app.get("/messages", async (req, res) => {
  const user = req.headers.user;
  const { limit } = req.query;
  const limitNum = Number(limit);

  try {
    const messages = await db
      .collection("messages")
      .find({
        $or: [
          { type: "message" },
          { to: { $in: [user, "Todos"] } },
          { from: user },
        ],
      })
      .limit(limit === undefined ? 0 : limitNum)
      .toArray();

    if (limit !== undefined && (limitNum <= 0 || isNaN(limitNum))) {
      return res.sendStatus(422);
    }

    res.send(messages);
  } catch (err) {
    res.status(422).send(err.message);
  }
});

// post status
app.post("/status", async (req, res) => {
  const user = req.headers.user;

  if (!user) {
    return res.sendStatus(404);
  }

  try {
    const result = await db.collection("participants").updateOne(
      { name: user },
      { $set: { lastStatus: Date.now() } }
    );

    if (result.matchedCount === 0) {
      return res.sendStatus(404);
    }

    return res.sendStatus(200);
  } catch (err) {
    return res.sendStatus(500);
  }
});

setInterval(async () => {
  try {
    const inactiveParticipants = await db
      .collection("participants")
      .find({ lastStatus: { $lt: Date.now() - 10000 } })
      .toArray();

    if (inactiveParticipants.length > 0) {
      const messages = inactiveParticipants.map((participant) => {
        return {
          from: participant.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss"),
        };
      });

      await db.collection("messages").insertMany(messages);
      await db
        .collection("participants")
        .deleteMany({ lastStatus: { $lt: Date.now() - 10000 } });
    }
  } catch (err) {
    console.log(err.message);
  }
}, 15000);

// Ligar a aplicação do servidor para ouvir requisições
const PORT = 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));