import express from "express"
import cors from "cors"
import { MongoClient, ObjectId } from "mongodb"
import dotenv from "dotenv"
import dayjs from "dayjs"
import Joi from "joi"

// Criação do app
const app = express()

// Configurações 
app.use(cors())
app.use(express.json())
dotenv.config()

// conexão com o banco
console.log(process.env.DATABASE_URL)
const mongoClient = new MongoClient(process.env.DATABASE_URL)

try {
    await mongoClient.connect()
    console.log("MongoDB conectado!")
} catch (err) {
    (err) => console.log(err.message)
}

const db = mongoClient.db()

// post / participants
app.post("/participants", async (req, res) => {
    const { name } = req.body;

    const schemaParticipant = Joi.object({
        name: Joi.string().required()
    });

    const validation = schemaParticipant.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message);
        return res.status(422).send(errors);
    }

    try {
        const User = await db.collection("participants").findOne({ name: name });
        if (User) return res.sendStatus(409);

        const timestamp = Date.now()


        await db.collection("participants").insertOne({ name, lastStatus: timestamp });

        const message = {
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs(timestamp).format('HH:mm:ss')
        };

        await db.collection("messages").insertOne(message);

        res.sendStatus(201);

    } catch (err) {
        res.status(500).send(err.message);
    }
});

//get /participants
app.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection("participants").find().toArray();
        res.send(participants || []);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

//post /messages
app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { User } = req.headers;

    console.log(User)

    const schemaParticipant = Joi.object({
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid('message', 'private_message').required()
    });

    const validation = schemaParticipant.validate({ ...req.body, from: User }, { abortEarly: false });


    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message);
        return res.status(422).send(errors);
    }

    try {
        const participant = await db.collection("participants").findOne({ name: User });
        if (!participant) {
            return res.sendStatus(422)
        }

        const message = {
            to,
            text,
            type,
            from: User,
            time: dayjs().format('HH:mm:ss')
        };

        await db.collection("messages").insertOne(message);
        return res.sendStatus(201);
    } catch (err) {
        return res.sendStatus(500);
    }
});

//get messages
app.get("/messages", async (req, res) => {
    const { User } = req.headers;
    const { limit } = req.query;
    const limitNum = Number(limit);

    try {
        const messages = await db.collection("messages")
            .find({
                $or: [
                    { type: "message" },
                    { to: { $in: [User, "Todos"] } },
                    { from: User }
                ]
            })
            .limit(limit === undefined ? 0 : limitNum)
            .toArray();

        if (limit !== undefined && (limitNum <= 0 || isNaN(limitNum))) {
            return res.sendStatus(422); nom
        }

        res.send(messages);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

//post status  
app.post("/status", async (req, res) => {
    try {
        const participantName = req.header("User");

        if (!participantName) {
            return res.status(404).send();
        }

        const participant = participants.find((p) => p.name === participantName);

        if (!participant) {
            return res.status(404).send();
        }

        participant.lastStatus = Date.now();

        return res.status(200).send();
    } catch (err) {
        console.error(err);
        return res.status(500).send("Internal Server Error");
    }
});

// Ligar a aplicação do servidor para ouvir requisições
const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))