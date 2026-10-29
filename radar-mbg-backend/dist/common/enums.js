export var TripStatus;
(function (TripStatus) {
    TripStatus["DRAFT"] = "DRAFT";
    TripStatus["SCHEDULED"] = "SCHEDULED";
    TripStatus["READY_TO_DEPART"] = "READY_TO_DEPART";
    TripStatus["IN_TRANSIT"] = "IN_TRANSIT";
    TripStatus["ARRIVAL_DETECTED"] = "ARRIVAL_DETECTED";
    TripStatus["ARRIVAL_VERIFIED"] = "ARRIVAL_VERIFIED";
    TripStatus["DELIVERY_IN_PROGRESS"] = "DELIVERY_IN_PROGRESS";
    TripStatus["DELIVERED"] = "DELIVERED";
    TripStatus["COMPLETED"] = "COMPLETED";
    TripStatus["CANCELLED"] = "CANCELLED";
    TripStatus["EXCEPTION"] = "EXCEPTION";
})(TripStatus || (TripStatus = {}));
export var TrackingStatus;
(function (TrackingStatus) {
    TrackingStatus["LIVE"] = "LIVE";
    TrackingStatus["STALE"] = "STALE";
    TrackingStatus["OFFLINE"] = "OFFLINE";
    TrackingStatus["GPS_UNAVAILABLE"] = "GPS_UNAVAILABLE";
    TrackingStatus["ENDED"] = "ENDED";
})(TrackingStatus || (TrackingStatus = {}));
export var VerificationStatus;
(function (VerificationStatus) {
    VerificationStatus["NOT_STARTED"] = "NOT_STARTED";
    VerificationStatus["PENDING"] = "PENDING";
    VerificationStatus["VERIFIED"] = "VERIFIED";
    VerificationStatus["FAILED"] = "FAILED";
    VerificationStatus["MANUAL_REVIEW"] = "MANUAL_REVIEW";
    VerificationStatus["OVERRIDDEN"] = "OVERRIDDEN";
})(VerificationStatus || (VerificationStatus = {}));
export var DeliveryStatus;
(function (DeliveryStatus) {
    DeliveryStatus["NOT_STARTED"] = "NOT_STARTED";
    DeliveryStatus["IN_PROGRESS"] = "IN_PROGRESS";
    DeliveryStatus["DELIVERED"] = "DELIVERED";
    DeliveryStatus["PARTIAL"] = "PARTIAL";
    DeliveryStatus["FAILED"] = "FAILED";
    DeliveryStatus["UNDER_REVIEW"] = "UNDER_REVIEW";
})(DeliveryStatus || (DeliveryStatus = {}));
export var Role;
(function (Role) {
    Role["SUPER_ADMIN"] = "SUPER_ADMIN";
    Role["ADMIN_OPS"] = "ADMIN_OPS";
    Role["COORDINATOR"] = "COORDINATOR";
    Role["ADMIN_SPPG"] = "ADMIN_SPPG";
    Role["DISPATCHER"] = "DISPATCHER";
    Role["DRIVER"] = "DRIVER";
    Role["RECEIVER"] = "RECEIVER";
    Role["AUDITOR"] = "AUDITOR";
    Role["LEADER"] = "LEADER";
})(Role || (Role = {}));
export const ALLOWED_TRANSITIONS = {
    [TripStatus.DRAFT]: [TripStatus.SCHEDULED, TripStatus.CANCELLED],
    [TripStatus.SCHEDULED]: [TripStatus.READY_TO_DEPART, TripStatus.CANCELLED],
    [TripStatus.READY_TO_DEPART]: [TripStatus.IN_TRANSIT, TripStatus.CANCELLED],
    [TripStatus.IN_TRANSIT]: [TripStatus.ARRIVAL_DETECTED, TripStatus.CANCELLED, TripStatus.EXCEPTION],
    [TripStatus.ARRIVAL_DETECTED]: [TripStatus.ARRIVAL_VERIFIED, TripStatus.IN_TRANSIT, TripStatus.EXCEPTION],
    [TripStatus.ARRIVAL_VERIFIED]: [TripStatus.DELIVERY_IN_PROGRESS, TripStatus.EXCEPTION],
    [TripStatus.DELIVERY_IN_PROGRESS]: [TripStatus.DELIVERED, TripStatus.EXCEPTION],
    [TripStatus.DELIVERED]: [TripStatus.COMPLETED],
    [TripStatus.COMPLETED]: [],
    [TripStatus.CANCELLED]: [],
    [TripStatus.EXCEPTION]: [TripStatus.IN_TRANSIT, TripStatus.COMPLETED, TripStatus.CANCELLED],
};
//# sourceMappingURL=enums.js.map