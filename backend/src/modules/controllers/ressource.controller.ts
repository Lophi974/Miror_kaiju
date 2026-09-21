import { getRessourcesByQuarterIdService } from '../services/ressource.service.ts';

export async function getResssourcesByQuarterId(req: { params: { quarterId: string } }, res: any) {
    const { quarterId } = req.params;

    if(!quarterId) {
        return res.status(400).json({ success: false, message: "Quarter ID is required" });
    }

    const ressources = await getRessourcesByQuarterIdService(quarterId);
    
    if(!ressources) {
        return res.status(404).json({ success: false, message: "No ressources found for the given quarter ID" });
    }

    return res.status(200).json({ success: true, data: ressources });

}