export function isSenderAllowed(senderName, whitelist) {
    const normalizedWhitelist = Array.isArray(whitelist) ? whitelist : [];
    if(normalizedWhitelist.length === 0){
        return true;
    }

    const normalizedSender = (senderName || "").trim().toLowerCase();
    if(normalizedSender.length === 0){
        return false;
    }

    return normalizedWhitelist.some((entry) => (entry || "").trim().toLowerCase() === normalizedSender);
}

export default {
    isSenderAllowed,
};
