export interface Pod {
    id: string;
    tripId: string;
    planned: number;
    dispatched: number;
    received: number;
    damaged: number;
    shortage: number;
    varianceReason?: string;
    receiverId: string;
    submittedAt: string;
    status: 'POD_PENDING' | 'POD_SUBMITTED' | 'POD_VALIDATING' | 'POD_ACCEPTED' | 'POD_REJECTED' | 'POD_NEEDS_REVIEW';
}
export declare class PodService {
    private pods;
    submit(data: Omit<Pod, 'id' | 'submittedAt' | 'status' | 'shortage'>): Pod;
    list(tripId?: string): Pod[];
    review(id: string, status: Pod['status']): Pod;
}
