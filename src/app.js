import express from "express"
import cors from "cors"
import { MongoClient, ObjectId } from "mongodb"
import dotenv from "dotenv"
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

    const schemaUser = Joi.object({
        name: Joi.string().required()
    });

    const validation = schemaUser.validate(req.body, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message);
        return res.status(422).send(errors);
    }

    try {
        const user = await db.collection("participants").findOne({ name: name });
        if (user) return res.status(409).send("Esse usuário já existe");

        const participant = {
            name: name,
            lastStatus: Date.now()
        };

        await db.collection("participants").insertOne(participant);

        const message = {
            user: name,
            time: dayjs().format('YYYY-MM-DD HH:mm:ss')
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
    const { from } = req.headers;

    const schemaMessage = Joi.object({
        to: Joi.string().required(),
        text: Joi.string().required(),
        type: Joi.string().valid('message', 'private_message').required()
    });

    const { error } = schemaMessage.validate({ to, text, type });

    if (error) {
        const errors = error.details.map(detail => detail.message);
        return res.status(422).send(errors);
    }

    try {
        const participant = await db.collection("participants").findOne({ name: from });
        if (!participant) {
            return res.status(422).send("O participante 'from' não existe na lista de participantes.");
        }

        const time = dayjs().format('HH:mm:ss');

        const message = {
            to,
            text,
            type,
            from,
            time
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

    try {
        let query = {
            $or: [
                { type: "message" },
                { from: "Todos" },
                { to: User },
                { from: User }
            ]
        };

        let options = {};

        if (limit) {
            const parsedLimit = parseInt(limit);

            if (isNaN(parsedLimit) || parsedLimit <= 0) {
                return res.status(422).send("O parâmetro 'limit' deve ser um número inteiro positivo.");
            }

            options.limit = parsedLimit;
        }

        const messages = await db.collection("messages").find(query).sort({ _id: -1 }).limit(options.limit).toArray();

        res.send(messages);
    } catch (err) {
        res.status(500).send(err.message);
    }
});
// Ligar a aplicação do servidor para ouvir requisições
const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))