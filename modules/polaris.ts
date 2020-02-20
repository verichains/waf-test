export const WAF = {
    BLOCKED_BY_ML: 'x-polaris-blocked-by-ml',
    BLOCKED_BY_BEHAVIOR: 'x-polaris-blocked-by-behavior',
    REQUEST_ID: 'x-polaris-requestid',
    ML_SCORE: 'x-polaris-ml-score'
};

export function extractScore(headers) {
    let score = {};
    if (headers) {
        if ('x-polaris-debug--scores' in headers) {
            score = {...JSON.parse(headers['x-polaris-debug--scores'])};
        }

        const extraScore = Object.values(WAF);

        for (let k of extraScore) {
            if (k in headers) {
                score[k] = headers[k];
            }
        }

        // Process when 2 ml score appear
        score[WAF.ML_SCORE] = calculateMLScore(score[WAF.ML_SCORE]);
    }
    return score;
}

export function calculateMLScore(score) {
    return score && [...new Set(score.split(',').map(a => a.trim()))].join(',');
}