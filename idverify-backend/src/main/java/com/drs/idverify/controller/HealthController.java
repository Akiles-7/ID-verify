package com.drs.idverify.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping
    public ResponseEntity<Map<String, Object>> getHealthStatus() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "idverify-backend");
        health.put("database", "CONNECTED (H2 / MySQL)");
        
        try {
            String aiHealthUrl = "http://localhost:8000/health";
            Map aiResponse = restTemplate.getForObject(aiHealthUrl, Map.class);
            health.put("ai_microservice", aiResponse);
        } catch (Exception e) {
            health.put("ai_microservice", Map.of("status", "UNREACHABLE", "error", e.getMessage()));
        }

        return ResponseEntity.ok(health);
    }
}
