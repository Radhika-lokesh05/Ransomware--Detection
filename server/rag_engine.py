import os

try:
    from sentence_transformers import SentenceTransformer, util
    HAS_TRANSFORMERS = True
except ImportError:
    HAS_TRANSFORMERS = False

class RAGEngine:
    """
    A simple Retrieval-Augmented Generation (RAG) layer for threat explanation.
    Uses sentence-transformers if available, otherwise falls back to keyword matching.
    """
    def __init__(self):
        # Small internal knowledge base
        self.knowledge_base = [
            {
                "id": "kb_1", 
                "text": "High CPU + rapid file changes indicate ransomware", 
                "explanation": "The system is exhibiting classic ransomware traits: mass file modifications coupled with high CPU utilization, indicative of an ongoing encryption process.", 
                "action": "Isolate the system from the network immediately and initiate a secure backup to prevent further data loss."
            },
            {
                "id": "kb_2", 
                "text": "Encryption-like behavior suggests malicious activity", 
                "explanation": "Rapid sequential file access suggests that a malicious payload is attempting to encrypt user data.", 
                "action": "Kill the suspicious process, disconnect from the network, and review forensic logs."
            },
            {
                "id": "kb_3", 
                "text": "Low CPU but high file I/O suggests data exfiltration or stealthy ransomware", 
                "explanation": "The system is experiencing unusually high disk activity without corresponding CPU spikes, which may indicate data theft or a stealthy encryption algorithm.", 
                "action": "Monitor outbound network traffic and pause non-essential background services."
            }
        ]
        
        self.has_transformers = HAS_TRANSFORMERS
        
        if self.has_transformers:
            try:
                # Load a lightweight, fast model suitable for hackathons
                self.model = SentenceTransformer('all-MiniLM-L6-v2')
                self.corpus_embeddings = self.model.encode([item["text"] for item in self.knowledge_base], convert_to_tensor=True)
                print("[RAG] Loaded sentence-transformers model successfully.")
            except Exception as e:
                print(f"[RAG] Error loading model, falling back to keyword match. {e}")
                self.has_transformers = False
                self.model = None
        else:
            self.model = None
            print("[RAG] sentence-transformers not installed. Using lightweight keyword-based in-memory store.")

    def retrieve_context(self, query):
        """Retrieves the most relevant knowledge base entry for the given query."""
        if self.has_transformers and self.model:
            try:
                query_embedding = self.model.encode(query, convert_to_tensor=True)
                hits = util.semantic_search(query_embedding, self.corpus_embeddings, top_k=1)[0]
                if hits:
                    best_match = self.knowledge_base[hits[0]['corpus_id']]
                    return best_match
            except Exception:
                pass

        # Fallback in-memory keyword matching if ChromaDB/Transformers aren't available
        query_lower = query.lower()
        if "encryption" in query_lower:
            return self.knowledge_base[1]
        elif "cpu" in query_lower or "file" in query_lower:
            return self.knowledge_base[0]
            
        return self.knowledge_base[0]

    def generate_explanation(self, log, context=None):
        """Generates an explanation and recommended action based on the retrieved context."""
        query = f"Threat detected: CPU usage {log.get('cpu_usage', 0)}%, File changes {log.get('file_changes', 0)}. Process: {log.get('process_name', 'unknown')}."
        
        if not context:
            context = self.retrieve_context(query)
            
        return {
            "rag_explanation": f"AI Investigation ({context['text']}): {context['explanation']}",
            "recommended_action": context['action']
        }

# Singleton instance
rag = RAGEngine()
