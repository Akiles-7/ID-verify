package com.drs.idverify.controller;

import com.drs.idverify.service.DemoDataService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/demo")
public class DemoController {

    private final DemoDataService demoDataService;

    public DemoController(DemoDataService demoDataService) {
        this.demoDataService = demoDataService;
    }

    @PostMapping("/seed")
    public ResponseEntity<Map<String, Object>> seedDemoData() {
        demoDataService.seedDemoData();
        return ResponseEntity.ok(Map.of("message", "Demo cases seeded successfully", "status", "SUCCESS"));
    }

    @DeleteMapping("/clear")
    public ResponseEntity<Map<String, Object>> clearAllCases() {
        demoDataService.clearAllCases();
        return ResponseEntity.ok(Map.of("message", "All cases cleared", "status", "SUCCESS"));
    }
}
