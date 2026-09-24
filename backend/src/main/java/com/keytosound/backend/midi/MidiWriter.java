package com.keytosound.backend.midi;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import javax.sound.midi.InvalidMidiDataException;
import javax.sound.midi.MetaMessage;
import javax.sound.midi.MidiEvent;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Sequence;
import javax.sound.midi.ShortMessage;
import javax.sound.midi.Track;
import org.springframework.stereotype.Component;

/**
 * Encodes a score as a Standard MIDI File, type 1: a conductor track (title
 * and tempo) and one track each for lead, pad, bass and drums, so a DAW opens
 * it as a full arrangement. General MIDI programs and drum notes, so it sounds
 * sensible on any synth without setup.
 */
@Component
public class MidiWriter {

    public static final int PPQ = 480;
    public static final int DRUM_CHANNEL = 9;

    private static final int LEAD_CHANNEL = 0;
    private static final int PAD_CHANNEL = 1;
    private static final int BASS_CHANNEL = 2;
    private static final int PAD_PROGRAM = 89; // Pad 2 (warm)
    private static final int BASS_PROGRAM = 38; // Synth Bass 1
    private static final long DRUM_TICKS = PPQ / 4; // a 16th

    private static final Map<String, Integer> LEAD_PROGRAMS = Map.of(
            "piano", 0, // Acoustic Grand Piano
            "electricPiano", 4, // Electric Piano 1
            "synthLead", 81, // Lead 2 (sawtooth)
            "eightBit", 80, // Lead 1 (square)
            "bass", 38); // Synth Bass 1

    private static final Map<String, Integer> DRUM_NOTES = Map.of(
            "kick", 36, "snare", 38, "hat", 42, "openHat", 46, "clap", 39, "perc", 45, "fx", 49);

    /** The score must already be validated: unknown instruments and voices are rejected by Score's constraints, not here. */
    public byte[] write(String title, Score score) {
        try {
            Sequence sequence = new Sequence(Sequence.PPQ, PPQ);
            int bpm = score.bpm();

            Track conductor = sequence.createTrack();
            conductor.add(new MidiEvent(trackName(title), 0));
            conductor.add(new MidiEvent(tempo(bpm), 0));

            Track lead = sequence.createTrack();
            lead.add(new MidiEvent(trackName("Lead"), 0));
            lead.add(program(LEAD_CHANNEL, LEAD_PROGRAMS.get(score.leadInstrument())));
            addNotes(lead, LEAD_CHANNEL, score.lead(), bpm);

            Track pad = sequence.createTrack();
            pad.add(new MidiEvent(trackName("Pad"), 0));
            pad.add(program(PAD_CHANNEL, PAD_PROGRAM));
            addNotes(pad, PAD_CHANNEL, score.pad(), bpm);

            Track bass = sequence.createTrack();
            bass.add(new MidiEvent(trackName("Bass"), 0));
            bass.add(program(BASS_CHANNEL, BASS_PROGRAM));
            addNotes(bass, BASS_CHANNEL, score.bass(), bpm);

            Track drums = sequence.createTrack();
            drums.add(new MidiEvent(trackName("Drums"), 0));
            for (DrumHit hit : score.drums()) {
                long on = ticks(hit.start(), bpm);
                addNote(drums, DRUM_CHANNEL, DRUM_NOTES.get(hit.voice()), midiVelocity(hit.velocity()),
                        on, on + DRUM_TICKS);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            MidiSystem.write(sequence, 1, out);
            return out.toByteArray();
        } catch (InvalidMidiDataException | IOException e) {
            // Inputs are validated before they get here, so this is a bug, not bad input.
            throw new IllegalStateException("Could not encode MIDI", e);
        }
    }

    static long ticks(double seconds, int bpm) {
        return Math.round(seconds * bpm / 60.0 * PPQ);
    }

    static int midiVelocity(double velocity) {
        return Math.max(1, Math.min(127, (int) Math.round(velocity * 127)));
    }

    private static void addNotes(Track track, int channel, List<ScoreNote> notes, int bpm)
            throws InvalidMidiDataException {
        for (ScoreNote note : notes) {
            long on = ticks(note.start(), bpm);
            // A note must last at least one tick, or some players drop it.
            long off = Math.max(on + 1, ticks(note.start() + note.duration(), bpm));
            addNote(track, channel, note.pitch(), midiVelocity(note.velocity()), on, off);
        }
    }

    private static void addNote(Track track, int channel, int pitch, int velocity, long on, long off)
            throws InvalidMidiDataException {
        track.add(new MidiEvent(new ShortMessage(ShortMessage.NOTE_ON, channel, pitch, velocity), on));
        track.add(new MidiEvent(new ShortMessage(ShortMessage.NOTE_OFF, channel, pitch, 0), off));
    }

    private static MidiEvent program(int channel, int program) throws InvalidMidiDataException {
        return new MidiEvent(new ShortMessage(ShortMessage.PROGRAM_CHANGE, channel, program, 0), 0);
    }

    private static MetaMessage tempo(int bpm) throws InvalidMidiDataException {
        int micros = 60_000_000 / bpm;
        byte[] data = {(byte) (micros >> 16), (byte) (micros >> 8), (byte) micros};
        return new MetaMessage(0x51, data, data.length);
    }

    private static MetaMessage trackName(String name) throws InvalidMidiDataException {
        byte[] data = (name == null ? "" : name).getBytes(StandardCharsets.UTF_8);
        return new MetaMessage(0x03, data, data.length);
    }
}
