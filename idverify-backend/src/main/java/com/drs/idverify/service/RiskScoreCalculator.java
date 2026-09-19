package com.drs.idverify.service;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
public class RiskScoreCalculator {

    public Map<String, Object> calculate(
            int validationFailCount, int validationTotalCount, boolean mrzChecksumPass,
            int overallTamperConfidence, boolean faceMatch, double faceDistance,
            BigDecimal w1, BigDecimal w2, BigDecimal w3, BigDecimal w4,
            int highThreshold, int mediumThreshold) {

        double mrzPassVal = mrzChecksumPass ? 1.0 : 0.0;
        double tamperVal = overallTamperConfidence / 100.0;
        double faceSimVal = !faceMatch ? 0.0 : Math.max(0.0, 1.0 - faceDistance);
        double failRatio = validationTotalCount > 0 ? ((double) validationFailCount / validationTotalCount) : 0.0;

        double scoreVal = w1.doubleValue() * (1.0 - mrzPassVal)
                        + w2.doubleValue() * tamperVal
                        + w3.doubleValue() * (1.0 - faceSimVal)
                        + w4.doubleValue() * failRatio;

        int totalScore = (int) Math.round(Math.min(100.0, Math.max(0.0, scoreVal * 100.0)));

        String band = "LOW";
        if (totalScore >= highThreshold) {
            band = "HIGH";
        } else if (totalScore >= mediumThreshold) {
            band = "MEDIUM";
        }

        int contribMrz = (int) Math.round(w1.doubleValue() * (1.0 - mrzPassVal) * 100.0);
        int contribTamper = (int) Math.round(w2.doubleValue() * tamperVal * 100.0);
        int contribFace = (int) Math.round(w3.doubleValue() * (1.0 - faceSimVal) * 100.0);
        int contribValidation = (int) Math.round(w4.doubleValue() * failRatio * 100.0);

        List<String> flags = new ArrayList<>();
        if (!mrzChecksumPass) flags.add("MRZ checksum mismatch — data altered");
        if (tamperVal > 0.6) flags.add("High tampering confidence");
        if (!faceMatch) flags.add("Face identity mismatch");
        if (validationFailCount > 0) flags.add(validationFailCount + "/" + validationTotalCount + " validation checks failed");

        return Map.of(
                "totalScore", totalScore,
                "band", band,
                "contributions", Map.of(
                        "mrz", contribMrz,
                        "tamper", contribTamper,
                        "face", contribFace,
                        "validation", contribValidation
                ),
                "activeFlags", flags,
                "formula", "score = w1·(1-mrz_pass) + w2·tamper + w3·(1-face_sim) + w4·(fail/total)"
        );
    }
}
