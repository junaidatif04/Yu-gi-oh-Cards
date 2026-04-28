export interface Card {
    id: number;
    name: string;
    type: string;
    desc: string;
    atk?: number;
    def?: number;
    level?: number;
    race?: string;
    attribute?: string;
    card_images: {
        image_url: string;
        image_url_small: string;
    }[];
}

export interface Deck {
    id: string;
    name: string;
    main: Card[];
    extra: Card[];
    side: Card[];
    lastUpdated?: any; // Firestore timestamp
}

export interface SharedDeck extends Deck {
    ownerName: string;
    ownerId: string;
    upvotes: number;
    downvotes: number;
    voteScore: number;
    createdAt?: any;
}

export interface ChatMessage {
    role: 'user' | 'bot';
    content: string;
    feedback?: {
        rating: 'up' | 'down';
        comment?: string;
    };
}