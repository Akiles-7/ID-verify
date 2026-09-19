package com.drs.idverify.controller;

import com.drs.idverify.model.User;
import com.drs.idverify.repository.CaseRepository;
import com.drs.idverify.repository.UserRepository;
import lombok.Data;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserRepository userRepository;
    private final CaseRepository caseRepository;
    private final PasswordEncoder passwordEncoder;

    public UserController(UserRepository userRepository, CaseRepository caseRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.caseRepository = caseRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<User>> getUsers() {
        return ResponseEntity.ok(userRepository.findAll());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createOfficer(@RequestBody CreateOfficerRequest req) {
        if (req.getUsername() == null || req.getUsername().isBlank()) {
            return ResponseEntity.badRequest().body("Username is required");
        }
        if (req.getPassword() == null || req.getPassword().isBlank()) {
            return ResponseEntity.badRequest().body("Password is required");
        }
        if (userRepository.findByUsername(req.getUsername().trim()).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body("Username already exists");
        }

        User newOfficer = User.builder()
                .username(req.getUsername().trim())
                .passwordHash(passwordEncoder.encode(req.getPassword()))
                .fullName(req.getFullName() != null && !req.getFullName().isBlank() ? req.getFullName().trim() : req.getUsername().trim())
                .role(req.getRole() != null && !req.getRole().isBlank() ? req.getRole().trim() : "ROLE_OFFICER")
                .designation(req.getDesignation() != null ? req.getDesignation().trim() : "Inspection Officer")
                .station(req.getStation() != null ? req.getStation().trim() : "Port Authority")
                .build();

        User saved = userRepository.save(newOfficer);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> deleteOfficer(@PathVariable Long id) {
        return userRepository.findById(id).map(user -> {
            if ("ROLE_ADMIN".equalsIgnoreCase(user.getRole()) || "admin".equalsIgnoreCase(user.getUsername())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Administrator account cannot be deleted"));
            }
            // Clear any officer references in cases to avoid foreign key violations
            try {
                caseRepository.findAll().forEach(c -> {
                    if (c.getOfficer() != null && c.getOfficer().getId().equals(id)) {
                        c.setOfficer(null);
                        caseRepository.save(c);
                    }
                });
            } catch (Exception ignored) {}

            userRepository.delete(user);
            return ResponseEntity.noContent().build();
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @Data
    public static class CreateOfficerRequest {
        private String username;
        private String password;
        private String fullName;
        private String designation;
        private String station;
        private String role;
    }
}
