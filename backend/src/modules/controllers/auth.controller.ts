import { success } from 'alchemy/Util/Clank';
import dotenv from 'dotenv';

dotenv.config();

export async function loginUser(req: {body :{email: string , password: string}}, res: any) {

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

}



