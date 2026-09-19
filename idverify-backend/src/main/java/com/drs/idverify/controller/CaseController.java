package com.drs.idverify.controller;

import com.drs.idverify.dto.Dtos.*;
import com.drs.idverify.service.CaseService;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cases")
public class CaseController {

    private final CaseService caseService;

    public CaseController(CaseService caseService) {
        this.caseService = caseService;
    }

    @GetMapping
    public ResponseEntity<Page<CaseSummaryDto>> getCases(
            @RequestParam(value = "filter", required = false, defaultValue = "ALL") String filter,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "10") int size) {
        return ResponseEntity.ok(caseService.getCases(filter, search, page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ScanResultDto> getCaseDetail(@PathVariable String id) {
        return ResponseEntity.ok(caseService.getCaseDetail(id));
    }

    @PostMapping("/{id}/clear")
    public ResponseEntity<Void> clearCase(@PathVariable String id, Authentication auth) {
        caseService.markCleared(id, 1L);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/escalate")
    public ResponseEntity<Void> escalateCase(@PathVariable String id, Authentication auth) {
        caseService.markEscalated(id, 1L);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteCase(@PathVariable String id, Authentication auth) {
        caseService.deleteCase(id, 1L);
        return ResponseEntity.noContent().build();
    }
}
