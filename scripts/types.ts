
export interface PlayerCSV {
    'Rank'?: string; // Explicit rank column
    'Status'?: string;
    'Full Name': string;
    'Email ID': string;
    'Phone Number'?: string;
    'Ladder Joined On'?: string;
    'Ladder Left On'?: string;
    'Bracket'?: string;
    'Cohort'?: string;
}

export interface MatchCSV {
    'Date': string; // e.g. 31/08/2024
    'Time': string; // e.g. 17:00
    'Bracket'?: string; // e.g. Open
    'Challenger Name': string;
    'Defender Name': string;
    'Winner': 'Challenger' | 'Defender';
    'Scoreline': string; // e.g. "3-1"
    'Sport Name'?: string; // Optional if passed via arg
}
