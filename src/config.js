import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

export default config;
export const admin_ids = config.admin_ids;
export const report_peer_id = config.report_peer_id;
