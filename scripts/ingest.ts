import { runIngestion } from "../src/ingestion/run";
runIngestion().catch(error=>{console.error(error);process.exitCode=1});
