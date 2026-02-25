package io.t402.a2a;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * A2A transport types for t402 payments.
 */
public final class A2ATypes {

    private A2ATypes() {}

    /**
     * A message part (text, file, or data).
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class MessagePart {
        public String kind;
        public String text;
        public Map<String, Object> file;
        public Map<String, Object> data;

        public MessagePart() {}

        public MessagePart(String kind, String text) {
            this.kind = kind;
            this.text = text;
        }

        public static MessagePart text(String text) {
            return new MessagePart("text", text);
        }
    }

    /**
     * An A2A message with optional payment metadata.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Message {
        public String kind = "message";
        @JsonProperty("messageId")
        public String messageId;
        public String role;
        public List<MessagePart> parts;
        public Map<String, Object> metadata;

        public Message() {}

        public Message(String role, List<MessagePart> parts, Map<String, Object> metadata) {
            this.role = role;
            this.parts = parts;
            this.metadata = metadata;
        }
    }

    /**
     * Current status of an A2A task.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class TaskStatus {
        public String state;
        public Message message;
        public String timestamp;

        public TaskStatus() {}

        public TaskStatus(String state, Message message) {
            this.state = state;
            this.message = message;
        }
    }

    /**
     * Output from a completed task.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Artifact {
        public String kind;
        public String name;
        public String description;
        public List<MessagePart> parts;
        @JsonProperty("mimeType")
        public String mimeType;
        public String data;
        public String uri;
        public Map<String, Object> metadata;

        public Artifact() {}
    }

    /**
     * An A2A task with status and history.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Task {
        public String kind = "task";
        public String id;
        @JsonProperty("sessionId")
        public String sessionId;
        public TaskStatus status;
        public List<Artifact> artifacts;
        public List<Message> history;
        public Map<String, Object> metadata;

        public Task() {}

        public Task(String id, TaskStatus status) {
            this.id = id;
            this.status = status;
        }
    }

    /**
     * An A2A extension declaration.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Extension {
        public String uri;
        public String description;
        public boolean required;

        public Extension() {}

        public Extension(String uri, String description, boolean required) {
            this.uri = uri;
            this.description = description;
            this.required = required;
        }
    }

    /**
     * A2A agent capabilities.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Capabilities {
        public boolean streaming;
        @JsonProperty("pushNotifications")
        public boolean pushNotifications;
        @JsonProperty("stateTransitionHistory")
        public boolean stateTransitionHistory;
        public List<Extension> extensions;

        public Capabilities() {}
    }

    /**
     * Agent provider information.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Provider {
        public String organization;
        public String url;

        public Provider() {}
    }

    /**
     * A2A skill definition.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Skill {
        public String id;
        public String name;
        public String description;
        public List<String> tags;
        public List<String> examples;
        @JsonProperty("inputModes")
        public List<String> inputModes;
        @JsonProperty("outputModes")
        public List<String> outputModes;

        public Skill() {}
    }

    /**
     * A2A agent card (service advertisement).
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class AgentCard {
        public String name;
        public String description;
        public String url;
        public Provider provider;
        public String version;
        @JsonProperty("documentationUrl")
        public String documentationUrl;
        public Capabilities capabilities;
        @JsonProperty("defaultInputModes")
        public List<String> defaultInputModes;
        @JsonProperty("defaultOutputModes")
        public List<String> defaultOutputModes;
        public List<Skill> skills;

        public AgentCard() {}
    }
}
